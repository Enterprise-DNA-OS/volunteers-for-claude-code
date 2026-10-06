#!/usr/bin/env node
// End-to-end smoke test on a throwaway database.
// Runs migrate, seed, then every CLI command that matters, and asserts on the JSON.
// Embedded PGlite by default; set TEST_DATABASE_URL to run the same checks on a
// disposable Postgres. Passes on Windows and Linux. No network.

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = mkdtempSync(path.join(tmpdir(), 'volunteers-smoke-'));
const env = { ...process.env, DATA_DIR: path.join(dataDir, 'db'), OUTPUT_DIR: dataDir };
if (process.env.TEST_DATABASE_URL) env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else delete env.DATABASE_URL;

let step = 0;
function run(label, args, { json = true, expectFail = false } = {}) {
  step++;
  const argv = [path.join(root, 'scripts', args[0]), ...args.slice(1), ...(json ? ['--json'] : [])];
  const res = spawnSync(process.execPath, argv, { cwd: root, env, encoding: 'utf8' });
  const ok = expectFail ? res.status !== 0 : res.status === 0;
  if (!ok) {
    console.error(`\nFAIL step ${step} (${label}): exit ${res.status}\n--- stdout\n${res.stdout}\n--- stderr\n${res.stderr}`);
    process.exit(1);
  }
  console.log(`  ok  ${String(step).padStart(2)}  ${label}`);
  if (!json || expectFail) return { stdout: res.stdout, stderr: res.stderr };
  try {
    return JSON.parse(res.stdout);
  } catch {
    console.error(`\nFAIL step ${step} (${label}): output is not JSON\n${res.stdout}\n${res.stderr}`);
    process.exit(1);
  }
}

function refuses(label, args, mustSay) {
  const r = run(label, args, { json: false, expectFail: true });
  const said = `${r.stdout}${r.stderr}`;
  assert(said.toLowerCase().includes(mustSay.toLowerCase()), `${label}: says "${mustSay}" (got: ${said.trim().slice(0, 200)})`);
  return said;
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`\nFAIL assertion: ${msg}`);
    process.exit(1);
  }
}

const n = (v) => Number(v ?? 0);
const vo = (...a) => ['volunteers.mjs', ...a];
const reasons = (rows) => new Set(rows.map((r) => r.reason));

console.log(`smoke: ${env.DATABASE_URL ? 'Postgres at TEST_DATABASE_URL' : 'embedded database'}, output ${dataDir}`);
try {
  run('migrate', ['migrate.mjs'], { json: false });
  run('migrate again (idempotent)', ['migrate.mjs'], { json: false });
  run('seed', ['seed.mjs'], { json: false });
  run('seed again (idempotent)', ['seed.mjs'], { json: false });

  // ---- the program ------------------------------------------------------------

  const stats = run('stats', vo('stats'));
  assert(stats.active === 17 && stats.applicants === 4 && stats.inactive === 2, `17 active, 4 applicants, 2 paused (${stats.active}, ${stats.applicants}, ${stats.inactive})`);
  assert(stats.roster_problems === 2, `two rostered without clearance (${stats.roster_problems})`);
  assert(stats.minutes_30d > 60 * 100, 'over 100 hours in the last 30 days');

  const attention = run('attention', vo('attention'));
  const why = reasons(attention);
  for (const r of ['ROSTERED WITHOUT CLEARANCE', 'CHECK BARRED', 'NOTIFIABLE INCIDENT', 'CHECK EXPIRED', 'SHIFT SHORT', 'CHECK NOT VERIFIED', 'INCIDENT OPEN',
    'CHECK EXPIRING', 'HOURS TO APPROVE', 'APPLICANT WAITING', 'UNDER 18 NO CONSENT', 'LAPSING', 'MILESTONE', 'NOT CONFIRMED']) {
    assert(why.has(r), `attention shows ${r}`);
  }
  assert(attention[0].rank === 1, 'a rank 1 item is first');
  assert(attention.some((a) => a.reason === 'ROSTERED WITHOUT CLEARANCE' && a.who === 'Josh Kemp' && /NSW Working with Children/.test(a.detail)), 'Josh is rostered with an expired NSW check');
  assert(attention.some((a) => a.reason === 'ROSTERED WITHOUT CLEARANCE' && a.who === 'Priya Raman' && /food-safety/.test(a.detail)), 'Priya is rostered with lapsed food safety');

  const vols = run('volunteers', vo('volunteers'));
  assert(vols.length === 17 && vols.every((v) => v.status === 'active'), 'active by default');
  assert(run('volunteers --all', vo('volunteers', '--all')).length === 24, 'all 24 with --all');
  const josh = run('volunteer card', vo('volunteer', 'josh'));
  assert(josh.volunteer.ref === 'V-1006' && josh.problems.length === 1 && josh.checks.some((c) => c.state === 'EXPIRED'), 'Josh found by partial name, with his expired check');
  run('an ambiguous name lists the candidates', vo('volunteer', 'a'), { json: false, expectFail: true });

  const apps = run('applicants', vo('applicants'));
  assert(apps.length === 4 && apps[0].stage === 'applied', 'applicants by stage');

  const checks = run('checks', vo('checks'));
  const states = new Set(checks.map((c) => c.state));
  for (const s of ['BARRED', 'EXPIRED', 'NOT VERIFIED', 'EXPIRING']) assert(states.has(s), `checks shows ${s}`);
  assert(!checks.some((c) => c.state === 'CURRENT' && n(c.days_left) > 60), 'current checks with time left are hidden');

  const training = run('training', vo('training'));
  assert(training.training.some((t) => t.ref === 'V-1005' && t.state === 'EXPIRED'), 'Priya food safety expired');

  // ---- the roster gates -----------------------------------------------------------

  const shifts = run('shifts', vo('shifts'));
  assert(shifts.length === 9, `nine shifts in 14 days (${shifts.length})`);
  assert(shifts.find((s) => s.ref === 'SH-2004').gap === 3, 'sorting room short by three');

  const gaps = run('gaps', vo('gaps'));
  const sorting = gaps.find((g) => g.ref === 'SH-2004');
  assert(sorting && sorting.candidates.some((c) => c.ref === 'V-1013'), 'Fiona is cleared for sorting');
  assert(!sorting.candidates.some((c) => c.ref === 'V-1014'), 'Tom is not: no manual handling');
  const driver = gaps.find((g) => g.ref === 'SH-2009');
  assert(!driver.candidates.some((c) => c.ref === 'V-1016'), 'Peter is paused after his injury and not offered');
  assert(gaps.find((g) => g.ref === 'SH-2008').candidates.length === 0, 'nobody else is cleared for Gold Coast mentoring');

  refuses('an applicant cannot be rostered', vo('roster', 'SH-2001', 'Sienna Moore'), 'volunteer is applicant');
  refuses('no manual handling, no sorting room', vo('roster', 'SH-2004', 'Tom Baxter'), 'manual-handling');
  refuses('under 18 without consent, refused', vo('roster', 'SH-2007', 'Noah Williams'), 'guardian consent');
  refuses('a barred check, refused', vo('roster', 'SH-2001', 'Mark Jessop'), 'barred');
  refuses('a full shift takes no more', vo('roster', 'SH-2005', 'Fiona Walsh'), 'already has');
  refuses('no double booking', vo('roster', 'SH-2003', 'Helen Achterberg'), 'already on SH-2002');

  const fiona = run('roster Fiona to sorting', vo('roster', 'SH-2004', 'Fiona Walsh'));
  assert(fiona.status === 'rostered', 'rostered');
  run('Fiona confirms', vo('confirm', 'SH-2004', 'Fiona'));
  run('consent for Noah', vo('volunteers', 'consent', 'Noah', '--guardian=Emma Williams'));
  run('Noah can now be rostered', vo('roster', 'SH-2007', 'Noah', '--confirmed'));
  run('Tom does manual handling', vo('training', 'add', 'Tom Baxter', '--course=manual-handling'));
  run('then Tom can sort', vo('roster', 'SH-2004', 'Tom Baxter'));

  // Josh renews his check; it counts only once verified.
  run('Josh records a new check', vo('checks', 'add', 'Josh Kemp', '--kind=wwcc', '--jurisdiction=NSW', '--number=WWC0661234V-R', '--expires=+1825'));
  assert(run('still not cleared before verifying', vo('volunteer', 'Josh Kemp')).problems.length === 1, 'an unverified check does not clear');
  refuses('verifying needs a name', vo('checks', 'verify', 'Josh Kemp', 'WWC0661234V-R'), 'who verified');
  run('verify it', vo('checks', 'verify', 'Josh Kemp', 'WWC0661234V-R', '--by=Leah Brandt'));
  assert(run('cleared once verified', vo('volunteer', 'Josh Kemp')).problems.length === 0, 'Josh is cleared');
  run('Priya renews food safety', vo('training', 'add', 'Priya', '--course=food-safety', '--years=3'));
  assert(run('roster problems cleared', vo('stats')).roster_problems === 0, 'nobody rostered without clearance');

  run('unroster', vo('unroster', 'SH-2007', 'Noah'));
  refuses('attendance waits for the day', vo('attend', 'SH-2002'), 'on the day or after');

  // A shift that happened yesterday: attendance writes the hours.
  run('add a shift for yesterday', vo('shifts', 'add', '--role=Shop assistant', '--on=-1', '--starts=9am', '--ends=1pm', '--needed=2'));
  const past = run('shifts in the past do not show', vo('shifts'));
  assert(!past.some((s) => s.ref === 'SH-2010'), 'SH-2010 is yesterday');
  refuses('no rostering into the past', vo('roster', 'SH-2010', 'Margaret'), 'record what happened');
  const added = run('a run of four weekly shifts', vo('shifts', 'add', '--role=R-501', '--on=+20', '--starts=08:00', '--ends=12:00', '--needed=4', '--weeks=4'));
  assert(added.length === 4, 'four shifts made');
  run('a Gold Coast mentoring shift', vo('shifts', 'add', '--role=R-302', '--on=+9', '--starts=15:30', '--ends=17:30'));
  refuses('an NSW check does not clear Queensland work', vo('roster', 'SH-2015', 'Amelia Tran'), 'QLD blue card');

  // ---- hours -------------------------------------------------------------------

  refuses('no hours in the future', vo('hours', 'log', 'Tom', '--program=Events', '--hours=3', '--on=+2'), 'after they are given');
  refuses('no 17 hour entries', vo('hours', 'log', 'Tom', '--program=Events', '--hours=17'), '16 hours');
  const logged = run('log hours', vo('hours', 'log', 'Lucy', '--role=Event crew', '--hours=2:30', '--on=-1', '--activity=Stall at the markets'));
  assert(logged.minutes === 150 && !logged.approved_on, 'logged and pending');
  const pending = run('pending hours', vo('hours', 'pending'));
  assert(pending.length === 4, `four pending (${pending.length})`);
  const before = run('hours', vo('hours'));
  refuses('approving needs a name', vo('hours', 'approve', '--all'), 'who is approving');
  const appr = run('approve all', vo('hours', 'approve', '--all', '--by=Rachel Moss'));
  assert(appr.approved === 4 && appr.minutes === 870, `four entries, 14.5 hours (${appr.approved}, ${appr.minutes})`);
  const after = run('hours after approval', vo('hours'));
  assert(after.total_minutes === before.total_minutes + 870, 'approved hours now count');
  const month = run('hours for a month', vo('hours', '--month=' + new Date().toISOString().slice(0, 7)));
  assert(month.from.endsWith('-01'), 'a month starts on the 1st');

  const funder = run('funder report', vo('funder', '--program=Community meals'));
  assert(funder.totals.length === 1 && funder.totals[0].minutes > 0 && funder.hour_value_cents === null, 'one program, no invented dollar value');

  // ---- recognition and retention ----------------------------------------------

  const ms = run('milestones', vo('milestones'));
  assert(ms.some((m) => m.ref === 'V-1001' && m.milestone === '10 years') && ms.some((m) => m.ref === 'V-1003' && m.milestone === '500 hours'), 'Margaret 10 years, Helen 500 hours');
  run('recognise Margaret', vo('recognise', 'Margaret', '--milestone=10 years', '--how=Morning tea and a card'));
  assert(!run('milestones after', vo('milestones')).some((m) => m.ref === 'V-1001'), 'Margaret recognised');

  const lapsing = run('lapsing', vo('lapsing'));
  assert(lapsing.some((l) => l.ref === 'V-1012') && !lapsing.some((l) => l.ref === 'V-1013'), 'Ian is lapsing; Fiona is back on the roster');
  run('log a call', vo('log', 'Ian McLeod', '--kind=call', '--body=Knee better, back on Mondays from next week', '--by=Rachel'));

  // ---- applicants to active ------------------------------------------------------

  refuses('no activation without references and induction', vo('volunteers', 'activate', 'Sienna'), 'references');
  run('Sienna references checked', vo('applicants', 'stage', 'Sienna', '--to=checks'));
  run('Sienna inducted', vo('applicants', 'stage', 'Sienna', '--to=inducted'));
  run('Sienna is active', vo('volunteers', 'activate', 'Sienna'));
  refuses('a barred applicant cannot be activated', vo('volunteers', 'activate', 'Mark Jessop'), 'barred');
  run('decline Mark', vo('applicants', 'decline', 'Mark Jessop', '--reason=Working with Children check outcome'));
  const added2 = run('add an applicant', vo('volunteers', 'add', '--first=Hemi', '--last=Walker', '--email=hemi@example.com', '--dob=2001-04-02', '--state=NSW'));
  assert(added2.ref === 'V-1025' && added2.status === 'applicant', 'next ref');
  refuses('farewell needs a reason', vo('volunteers', 'farewell', 'Jenny Lowe'), 'why are they leaving');
  run('farewell', vo('volunteers', 'farewell', 'Jenny Lowe', '--reason=Moved to Queensland'));

  // ---- incidents --------------------------------------------------------------------

  refuses('a notifiable incident cannot close unreported', vo('incidents', 'close', 'INC-03', '--actions=Ramp resurfaced'), 'regulator has not been told');
  run('notify the regulator', vo('incidents', 'notify', 'INC-03', '--reference=SW-20817'));
  run('close it', vo('incidents', 'close', 'INC-03', '--actions=Ramp resurfaced, non-slip mats down'));
  const inc = run('add an incident', vo('incidents', 'add', '--kind=near miss', '--what=Trolley wheel came off on the ramp', '--program=Community meals'));
  assert(inc.ref === 'INC-04', `INC-04 (${inc.ref})`);
  assert(run('open incidents', vo('incidents')).length === 2, 'INC-02 and INC-04 open');

  // ---- compliance ---------------------------------------------------------------------

  const comp = run('compliance', vo('compliance'));
  assert(comp.length === 11, 'eleven rules');
  const rule = (id) => comp.find((c) => c.rule === id);
  assert(rule('wwcc-current').count === 0 && rule('roster-cleared').count === 0 && rule('notifiable').count === 0, 'fixed rules are clean');
  assert(rule('wwcc-verified').count === 1, 'Grace still unverified');
  assert(comp.every((c) => c.source && c.source.length > 10), 'every rule cites a source');
  run('verify Grace', vo('checks', 'verify', 'Grace', '--by=Kirsty Dunn'));
  assert(run('compliance after', vo('compliance')).find((c) => c.rule === 'wwcc-verified').count === 0, 'Grace verified');
  run('compliance in words', vo('compliance'), { json: false });
  run('attention in words', vo('attention'), { json: false });
  run('gaps in words', vo('gaps'), { json: false });

  // ---- import from Better Impact ---------------------------------------------------------

  const profiles = path.join(dataDir, 'profiles.csv');
  const hoursCsv = path.join(dataDir, 'hours.csv');
  writeFileSync(profiles, [
    'Profile ID,First Name,Last Name,Email,Mobile Phone,Birth Date,City,Province/State,Status,Accepted Date,Emergency Contact,Emergency Contact Phone,WWCC Number,WWCC Expiry,T-Shirt Size',
    '88001,Kiri,Tane,kiri@example.com,0400 111 222,14/03/1990,Manly,NSW,Accepted,01/02/2024,Aroha Tane,0400 111 333,WWC1234567V,01/02/2029,M',
    '88002,Sam,Lee,sam.lee@example.com,0400 222 333,1985-07-20,Dee Why,NSW,Accepted,2023-05-10,,,,,L',
    '88003,,,,,,,,Applicant,,,,,,S',
    '88004,Margaret,Ellis,margaret.ellis@example.com,,,Manly,NSW,Accepted,2016-09-08,Don Ellis,0412 001 101,,,M',
  ].join('\r\n'));
  writeFileSync(hoursCsv, [
    'Profile ID,First Name,Last Name,Date Volunteered,Category,Activity,Hours',
    '88001,Kiri,Tane,05/09/2026,Op shops,Shop assistant,4',
    '88001,Kiri,Tane,12/09/2026,Op shops,Shop assistant,"3,5"',
    '88002,Sam,Lee,2026-09-14,Fundraising,Sausage sizzle,5',
    '99999,No,Body,2026-09-14,Op shops,Shop assistant,2',
  ].join('\r\n'));
  const dry = run('import dry run writes nothing', vo('import', 'better-impact', `--volunteers=${profiles}`, `--hours=${hoursCsv}`, '--dry-run'));
  assert(dry.volunteers_new === 2 && dry.volunteers_matched === 1 && dry.hours_new === 3, `two new, Margaret matched, three hours rows (${dry.volunteers_new}, ${dry.volunteers_matched}, ${dry.hours_new})`);
  assert(dry.unused_columns.volunteers.includes('T-Shirt Size'), 'unused columns are reported');
  assert(dry.problems.some((p) => /no name/.test(p)) && dry.problems.some((p) => /99999/.test(p)), 'a nameless row and an unknown volunteer are named');
  assert(run('the dry run wrote nothing', vo('volunteers', '--all')).length === 25, 'nothing written');
  const imp = run('import for real', vo('import', 'better-impact', `--volunteers=${profiles}`, `--hours=${hoursCsv}`));
  assert(imp.checks === 1 && imp.programs_new.includes('Fundraising') && imp.no_emergency.length === 1, 'one check, a new program from a category, the first audit item');
  const kiri = run('the imported check is not verified', vo('volunteer', 'Kiri Tane'));
  assert(kiri.checks[0].state === 'NOT VERIFIED' && kiri.hours_by_program[0].minutes_total === 450, 'check unverified, 7.5 hours carried');
  const again = run('re-import creates nothing', vo('import', 'better-impact', `--volunteers=${profiles}`, `--hours=${hoursCsv}`));
  assert(again.volunteers_new === 0 && again.hours_new === 0, 'idempotent');
  run('a missing import file fails loudly', vo('import', 'better-impact', `--volunteers=${path.join(dataDir, 'nope.csv')}`), { json: false, expectFail: true });

  // ---- export, views, documents ----------------------------------------------------

  const exp = run('export', vo('export', `--out=${path.join(dataDir, 'export')}`));
  assert(n(exp.counts.hours) > 1000 && existsSync(path.join(dataDir, 'export', 'volunteers.csv')), 'every record exported');
  run('npm run view', ['view.mjs'], { json: false });
  for (const v of ['week', 'hours']) assert(existsSync(path.join(dataDir, 'views', `${v}.html`)), `${v} view rendered`);
  run('npm run docs', ['docs.mjs'], { json: false });
  for (const doc of ['hours-statement', 'funder-report', 'screening-record', 'recognition-certificate']) assert(readdirSync(path.join(dataDir, 'docs-out', doc)).length > 0, `${doc} rendered`);
  run('help', ['volunteers.mjs', 'help'], { json: false });

  console.log(`\nPASS: ${step} checks`);
} finally {
  if (existsSync(dataDir)) {
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // Windows can hold the handle briefly; a leftover temp dir is harmless.
    }
  }
}
