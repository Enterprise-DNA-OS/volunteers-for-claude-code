#!/usr/bin/env node
// volunteers-for-claude-code: the one CLI. The slash commands call this; so can you.
//
//   node scripts/volunteers.mjs <command> [args] [--flags] [--json]
//
// Run with no arguments (or `help`) for the command list.
//
// This is a volunteer program's record the way Better Impact sold it: the
// programs and the roles inside them, volunteers from application to farewell,
// their screening checks and training, shifts and the roster, the hours given,
// recognition, incidents and notes. It sends nothing and connects to nothing:
// reminders, recheck requests, thank-you letters and references draft to
// drafts/, and a person sends them.
//
// The gates, and there are no force flags:
//   * nobody is rostered to a role unless they are cleared for it on that day:
//     every check the role needs (a Working with Children check from the state
//     the work is in, for anything child-related) verified and current, every
//     course current, old enough, active, no barred check, and guardian consent
//     if under 18
//   * nobody is made active without references, the induction and, under 18,
//     guardian consent; never with a barred check
//   * a check counts only once someone verifies it with the issuer
//   * hours are never logged for a future date, nor over 16 in a day
//   * a notifiable incident does not close until the regulator has been told
//
// Deliberately NOT here: payments, payroll, a volunteer portal, sending.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table, hours as fmtHours, isoDate, heading } from './lib/format.mjs';

// ---------------------------------------------------------------- arguments

const BOOL_FLAGS = new Set(['json', 'help', 'all', 'dry-run', 'notifiable', 'confirmed', 'approve']);

function parseArgv(argv) {
  const args = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') { flags.help = true; continue; }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      let name, value;
      if (eq > -1) { name = a.slice(2, eq); value = a.slice(eq + 1); }
      else {
        name = a.slice(2);
        const next = argv[i + 1];
        if (BOOL_FLAGS.has(name) || next === undefined || next.startsWith('--')) value = true;
        else value = argv[++i];
      }
      flags[name] = value;
    } else args.push(a);
  }
  return { args, flags };
}

class CliError extends Error {
  constructor(message, code = 1) { super(message); this.code = code; }
}

const num = (v) => Number(v ?? 0);
const str = (v) => (v === true || v === undefined || v === null ? '' : String(v));

// ---------------------------------------------------------------- dates

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const pad = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// AU and NZ exports write DD/MM/YYYY: the first number is the day unless the
// second is too big to be a month.
function parseDate(v, what = 'date') {
  if (!v || v === true) return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const lower = s.toLowerCase();
  if (lower === 'today') return today();
  if (lower === 'yesterday') return addDays(today(), -1);
  if (lower === 'tomorrow') return addDays(today(), 1);
  const rel = lower.match(/^([+-]\d+)d?$/);
  if (rel) return addDays(today(), Number(rel[1]));
  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const [day, month] = b > 12 ? [b, a] : [a, b];
    const year = slash[3].length === 2 ? `20${slash[3]}` : slash[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  throw new CliError(`"${v}" is not a ${what}. Use YYYY-MM-DD, today, or +7.`);
}

// "9:30", "09:30", "9.30am", "2pm" -> "HH:MM".
function parseTime(v, what) {
  if (!v || v === true) throw new CliError(`--${what} is required, like --${what}=09:30.`);
  const m = String(v).trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) throw new CliError(`"${v}" is not a time. Use 09:30 or 2pm.`);
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || Number(m[2] || 0) > 59) throw new CliError(`"${v}" is not a time.`);
  return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
}

// "2026-08", "Aug 2026" -> first and last day of that month.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
function parseMonth(v) {
  const s = String(v).trim().toLowerCase();
  let y, mo;
  let m = s.match(/^(\d{4})-(\d{1,2})$/);
  if (m) { y = m[1]; mo = Number(m[2]); }
  else if ((m = s.match(/^([a-z]{3})[a-z]*\s+(\d{4})$/)) && MONTHS.includes(m[1])) { y = m[2]; mo = MONTHS.indexOf(m[1]) + 1; }
  else throw new CliError(`"${v}" is not a month. Use 2026-08 or "Aug 2026".`);
  const from = `${y}-${String(mo).padStart(2, '0')}-01`;
  const next = mo === 12 ? `${Number(y) + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

// "3", "2.5", "2:30", "150m" -> minutes.
function parseHours(v) {
  if (v === undefined || v === true || v === '') throw new CliError('How long? --hours=3 (or 2.5, or 2:30).');
  const s = String(v).trim().toLowerCase();
  let m = s.match(/^(\d+):(\d{2})$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+)\s*m(in)?$/);
  if (m) return Number(m[1]);
  const n = Number(s.replace(/h(ours?)?$/, ''));
  if (!Number.isFinite(n) || n <= 0) throw new CliError(`"${v}" is not a number of hours.`);
  return Math.round(n * 60);
}

// ---------------------------------------------------------------- lookups

async function resolveRow(db, sql, params, label, term) {
  const rows = await db.query(sql, params);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No ${label} matches "${term}".`);
  const list = rows.slice(0, 10).map((r) => `  ${r.ref ? r.ref + '  ' : ''}${r.name || ''}${r.extra ? '  ' + r.extra : ''}`).join('\n');
  throw new CliError(`"${term}" matches ${rows.length} ${label} records. Which one?\n${list}`);
}

async function resolveVolunteer(db, term) {
  if (!term) throw new CliError('Which volunteer? Give a name (partial is fine) or a ref like V-1006.');
  const t = String(term).trim();
  const exact = await db.query(`select *, first_name || ' ' || last_name as name from volunteers
                                 where upper(ref) = upper($1) or lower(first_name || ' ' || last_name) = lower($1) or lower(email) = lower($1)`, [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, `select *, first_name || ' ' || last_name as name, status as extra from volunteers
                          where first_name || ' ' || last_name ilike $1 or email ilike $1 or external_ref = $2 order by ref`, [`%${t}%`, t], 'volunteer', t);
}

async function resolveStaff(db, term) {
  if (!term || term === true) return null;
  const t = String(term).trim();
  const exact = await db.query('select * from staff where lower(name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from staff where name ilike $1 order by name', [`%${t}%`], 'staff', t);
}

async function resolveProgram(db, term) {
  if (!term || term === true) throw new CliError('Which program? Give its name or ref like PR-02.');
  const t = String(term).trim();
  const exact = await db.query('select * from programs where upper(ref) = upper($1) or lower(name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select * from programs where name ilike $1 order by ref', [`%${t}%`], 'program', t);
}

async function resolveRole(db, term) {
  if (!term || term === true) throw new CliError('Which role? Give its name or ref like R-201.');
  const t = String(term).trim();
  const exact = await db.query('select r.*, p.name as extra from roles r join programs p on p.id = r.program_id where upper(r.ref) = upper($1) or lower(r.name) = lower($1)', [t]);
  if (exact.length === 1) return exact[0];
  return resolveRow(db, 'select r.*, p.name as extra from roles r join programs p on p.id = r.program_id where r.name ilike $1 or p.name ilike $1 order by r.ref', [`%${t}%`], 'role', t);
}

async function resolveShift(db, term) {
  if (!term) throw new CliError('Which shift? Give its ref, like SH-2004.');
  const rows = await db.query('select * from v_shifts where upper(ref) = upper($1)', [String(term).trim()]);
  if (rows.length === 1) return rows[0];
  throw new CliError(`No shift with ref "${term}". Run \`shifts\` for the list.`);
}

async function nextRef(db, tableName, prefix, start) {
  const [row] = await db.query(
    `select coalesce(max(substring(ref from '^${prefix}-(\\d+)$')::int), $1) + 1 as n from ${tableName}`,
    [start - 1],
  );
  return `${prefix}-${row.n}`;
}

async function staffOrDefault(db, flags) {
  const s = await resolveStaff(db, flags.by);
  if (s) return s;
  const [first] = await db.query("select * from staff where status = 'active' order by created_at, name limit 1");
  return first || null;
}

// ---------------------------------------------------------------- output

function out(flags, value, textFn) {
  if (flags.json) console.log(JSON.stringify(value, null, 2));
  else textFn();
}
const d = (v) => (v ? isoDate(v) : '');
const h = (v) => fmtHours(v);
const t5 = (v) => (v ? String(v).slice(0, 5) : '');

// ---------------------------------------------------------------- the program at a glance

async function cmdStats(db, flags) {
  const [s] = await db.query(`
    select (select count(*) from volunteers where status = 'active') as active,
           (select count(*) from volunteers where status = 'applicant') as applicants,
           (select count(*) from volunteers where status = 'inactive') as inactive,
           (select coalesce(sum(minutes), 0) from hours where approved_on is not null and worked_on >= current_date - 30) as minutes_30d,
           (select count(distinct volunteer_id) from hours where approved_on is not null and worked_on >= current_date - 30) as volunteers_30d,
           (select count(*) from v_shifts where status = 'open' and shift_on between current_date and current_date + 14) as shifts_14d,
           (select coalesce(sum(gap), 0) from v_shifts where status = 'open' and shift_on between current_date and current_date + 14) as places_open_14d,
           (select count(*) from v_roster_problems) as roster_problems,
           (select count(*) from v_checks where state in ('EXPIRED', 'EXPIRING', 'NOT VERIFIED') and volunteer_status = 'active') as checks_to_act_on,
           (select count(*) from hours where approved_on is null) as hours_to_approve,
           (select count(*) from v_attention) as attention`);
  const stats = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, num(v)]));
  out(flags, stats, () => {
    console.log(heading('The program at a glance'));
    console.log(`  ${stats.active} active volunteers, ${stats.applicants} applicants, ${stats.inactive} on a break`);
    console.log(`  last 30 days: ${h(stats.minutes_30d)} given by ${stats.volunteers_30d} volunteers`);
    console.log(`  next 14 days: ${stats.shifts_14d} shifts, ${stats.places_open_14d} places still open`);
    console.log(`  ${stats.roster_problems} rostered without clearance, ${stats.checks_to_act_on} check(s) to act on, ${stats.hours_to_approve} hours entr(ies) to approve`);
    console.log(`  ${stats.attention} item(s) needing a decision`);
  });
}

async function cmdAttention(db, flags) {
  const rows = await db.query('select * from v_attention order by rank, days desc nulls last, label');
  out(flags, rows, () => {
    console.log(heading('Needs a decision, worst first'));
    console.log(table(rows, [
      { key: 'reason', label: 'why' },
      { key: 'label', label: 'record' },
      { key: 'who', label: 'who', width: 18 },
      { key: 'program', label: 'program', width: 18 },
      { key: 'days', label: 'days', align: 'right' },
      { key: 'detail', label: 'detail', width: 72 },
    ]));
  });
}

// ---------------------------------------------------------------- volunteers

async function cmdVolunteers(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return volunteerAdd(db, flags);
  if (sub === 'activate') return volunteerActivate(db, args.slice(1), flags);
  if (sub === 'pause') return volunteerSetStatus(db, args.slice(1), flags, 'inactive');
  if (sub === 'farewell') return volunteerSetStatus(db, args.slice(1), flags, 'former');
  if (sub === 'consent') return volunteerConsent(db, args.slice(1), flags);
  const where = [];
  const params = [];
  if (flags.status) { params.push(str(flags.status)); where.push(`v.status = $${params.length}`); }
  else if (!flags.all) where.push("v.status = 'active'");
  if (flags.program) {
    const p = await resolveProgram(db, flags.program);
    params.push(p.id);
    where.push(`exists (select 1 from hours x where x.volunteer_id = v.volunteer_id and x.program_id = $${params.length} and x.worked_on >= current_date - 365)`);
  }
  const rows = await db.query(`select * from v_volunteers v ${where.length ? 'where ' + where.join(' and ') : ''} order by v.ref`, params);
  out(flags, rows, () => {
    console.log(heading('Volunteers'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'name', label: 'name' }, { key: 'status', label: 'status' }, { key: 'state', label: 'state' },
      { key: 'age', label: 'age', align: 'right' },
      { key: 'minutes_12m', label: '12 months', align: 'right', format: h },
      { key: 'minutes_total', label: 'all time', align: 'right', format: h },
      { key: 'last_shift_on', label: 'last shift', format: d }, { key: 'next_shift_on', label: 'next shift', format: d },
      { key: 'check_flags', label: 'checks', width: 44 },
      { key: 'roster_problems', label: 'problems', align: 'right', format: (v) => (num(v) ? v : '') },
    ]));
  });
}

async function cmdVolunteer(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  const [row] = await db.query('select * from v_volunteers where volunteer_id = $1', [v.id]);
  const checks = await db.query("select check_name(kind, jurisdiction) as check, number, issued_on, good_until, verified_on, outcome, state from v_checks where volunteer_id = $1 order by kind, issued_on desc", [v.id]);
  const training = await db.query('select course, completed_on, expires_on, state from v_training where volunteer_id = $1 order by course', [v.id]);
  const upcoming = await db.query(`select s.ref, s.shift_on, s.starts, s.ends, s.role, s.program, a.status from assignments a join v_shifts s on s.shift_id = a.shift_id
                                    where a.volunteer_id = $1 and s.shift_on >= current_date and a.status in ('rostered', 'confirmed') order by s.shift_on`, [v.id]);
  const problems = await db.query('select shift, shift_on, role, problem from v_roster_problems where volunteer_ref = $1 order by shift_on', [v.ref]);
  const byProgram = await db.query(`select p.name as program, sum(h.minutes) filter (where h.worked_on >= current_date - 365)::int as minutes_12m, sum(h.minutes)::int as minutes_total,
                                           max(h.worked_on) as last_on from hours h join programs p on p.id = h.program_id
                                     where h.volunteer_id = $1 and h.approved_on is not null group by p.name order by 3 desc`, [v.id]);
  const pending = await db.query('select worked_on, minutes, activity from hours where volunteer_id = $1 and approved_on is null order by worked_on', [v.id]);
  const recognised = await db.query('select milestone, awarded_on, how from recognitions where volunteer_id = $1 order by awarded_on desc', [v.id]);
  const due = await db.query('select milestone from v_milestones where volunteer_id = $1', [v.id]);
  const notes = await db.query('select n.noted_on, n.kind, s.name as by, n.body from notes n left join staff s on s.id = n.staff_id where n.volunteer_id = $1 order by n.noted_on desc limit 5', [v.id]);
  const card = { volunteer: row, record: v, checks, training, upcoming, problems, hours_by_program: byProgram, hours_pending: pending, recognitions: recognised, milestones_due: due.map((m) => m.milestone), notes };
  out(flags, card, () => {
    console.log(heading(`${row.name} (${v.ref}), ${v.status}${v.status === 'applicant' ? ', at ' + v.stage : ''}`));
    console.log(`  ${v.email || ''}  ${v.phone || ''}  ${v.suburb || ''} ${v.state || ''}${row.age !== null ? `  aged ${row.age}` : ''}`);
    if (row.age !== null && row.age < 18) console.log(`  under 18: ${v.guardian_consent_on ? `consent from ${v.guardian_name || 'guardian'} on ${d(v.guardian_consent_on)}` : 'NO GUARDIAN CONSENT ON FILE'}`);
    console.log(`  started ${d(v.started_on) || 'not yet'}, available ${v.availability || 'not recorded'}, emergency contact ${v.emergency_contact || 'NOT RECORDED'}`);
    console.log(`  ${h(row.minutes_12m)} in the last 12 months, ${h(row.minutes_total)} all time, last shift ${d(row.last_shift_on) || 'none'}`);
    for (const p of problems) console.log(`  NOT CLEARED for ${p.shift} (${p.role}, ${d(p.shift_on)}): ${p.problem}`);
    if (due.length) console.log(`  milestone to recognise: ${due.map((m) => m.milestone).join(', ')}`);
    console.log(heading('Checks'));
    console.log(table(checks, [{ key: 'check', label: 'check' }, { key: 'number', label: 'number' }, { key: 'issued_on', label: 'issued', format: d },
      { key: 'good_until', label: 'good until', format: d }, { key: 'verified_on', label: 'verified', format: d }, { key: 'state', label: 'state' }]));
    console.log(heading('Training'));
    console.log(table(training, [{ key: 'course', label: 'course' }, { key: 'completed_on', label: 'completed', format: d }, { key: 'expires_on', label: 'expires', format: d }, { key: 'state', label: 'state' }]));
    if (upcoming.length) {
      console.log(heading('Rostered'));
      console.log(table(upcoming, [{ key: 'ref', label: 'shift' }, { key: 'shift_on', label: 'date', format: d }, { key: 'starts', label: 'from', format: t5 }, { key: 'ends', label: 'to', format: t5 }, { key: 'role', label: 'role' }, { key: 'status', label: 'status' }]));
    }
    console.log(heading('Hours by program'));
    console.log(table(byProgram, [{ key: 'program', label: 'program' }, { key: 'minutes_12m', label: '12 months', align: 'right', format: h }, { key: 'minutes_total', label: 'all time', align: 'right', format: h }, { key: 'last_on', label: 'last', format: d }]));
    if (pending.length) console.log(`  waiting for approval: ${pending.map((p) => `${d(p.worked_on)} ${h(p.minutes)} ${p.activity || ''}`.trim()).join('; ')}`);
    if (notes.length) {
      console.log(heading('Notes'));
      console.log(table(notes, [{ key: 'noted_on', label: 'date', format: d }, { key: 'kind', label: 'kind' }, { key: 'by', label: 'by' }, { key: 'body', label: 'note', width: 80 }]));
    }
  });
}

async function volunteerAdd(db, flags) {
  const first = str(flags.first);
  const last = str(flags.last);
  if (!first || !last) throw new CliError('A volunteer needs --first= and --last=.');
  const ref = await nextRef(db, 'volunteers', 'V', 1001);
  const [row] = await db.query(`insert into volunteers (ref, first_name, last_name, email, phone, date_of_birth, suburb, state, availability, interests, source, applied_on, emergency_contact)
                                 values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning *`,
  [ref, first, last, str(flags.email) || null, str(flags.phone) || null, parseDate(flags.dob, 'date of birth'), str(flags.suburb) || null, str(flags.state).toUpperCase() || null,
    str(flags.availability) || null, str(flags.interests) || null, str(flags.source) || null, parseDate(flags.applied) || today(), str(flags.emergency) || null]);
  out(flags, row, () => console.log(`Added ${first} ${last} as ${ref}, applicant at "applied". Next: applicants stage ${ref} --to=interviewed`));
}

const STAGES = ['applied', 'interviewed', 'references', 'checks', 'inducted', 'done'];

// Activation: references, induction, consent for under 18s, no barred check.
async function activationProblems(db, v) {
  const problems = [];
  if (!v.references_ok_on) problems.push('references not recorded as checked');
  const [ind] = await db.query("select 1 from training where volunteer_id = $1 and course = 'induction'", [v.id]);
  if (!ind) problems.push('no induction on record');
  const [barred] = await db.query("select 1 from checks where volunteer_id = $1 and outcome = 'barred'", [v.id]);
  if (barred) problems.push('a check came back barred');
  const [age] = await db.query("select case when date_of_birth is null then null else extract(year from age(current_date, date_of_birth))::int end as age from volunteers where id = $1", [v.id]);
  if (age?.age !== null && age?.age < 18 && !v.guardian_consent_on) problems.push(`aged ${age.age} with no guardian consent`);
  if (!v.emergency_contact) problems.push('no emergency contact');
  return problems;
}

async function volunteerActivate(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  if (v.status === 'active') throw new CliError(`${v.name} is already active.`);
  const problems = await activationProblems(db, v);
  if (problems.length) throw new CliError(`${v.name} cannot be made active yet:\n${problems.map((p) => `  - ${p}`).join('\n')}`);
  const [row] = await db.query("update volunteers set status = 'active', stage = 'done', started_on = coalesce(started_on, $2), ended_on = null, end_reason = null where id = $1 returning *", [v.id, parseDate(flags.on) || today()]);
  out(flags, row, () => console.log(`${v.name} is active from ${d(row.started_on)}. Roles still check their own clearances at rostering.`));
}

async function volunteerSetStatus(db, args, flags, status) {
  const v = await resolveVolunteer(db, args.join(' '));
  const reason = str(flags.reason);
  if (status === 'former' && !reason) throw new CliError('Why are they leaving? --reason="Moved to Port Macquarie". It goes on their record.');
  const [row] = await db.query(`update volunteers set status = $2, ended_on = case when $2 = 'former' then $3::date else ended_on end, end_reason = coalesce($4, end_reason) where id = $1 returning *`,
    [v.id, status, parseDate(flags.on) || today(), reason || null]);
  const cancelled = await db.query(`update assignments a set status = 'cancelled' from shifts s where s.id = a.shift_id and a.volunteer_id = $1
                                     and a.status in ('rostered', 'confirmed') and s.shift_on >= current_date returning s.ref`, [v.id]);
  out(flags, { volunteer: row, cancelled: cancelled.map((c) => c.ref) }, () => {
    console.log(`${v.name} is now ${status}${reason ? ` (${reason})` : ''}.`);
    if (cancelled.length) console.log(`  taken off ${cancelled.length} upcoming shift(s): ${cancelled.map((c) => c.ref).join(', ')}. Run gaps to refill them.`);
  });
}

async function volunteerConsent(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  const guardian = str(flags.guardian);
  if (!guardian) throw new CliError('Who consented? --guardian="Emma Williams".');
  const [row] = await db.query('update volunteers set guardian_name = $2, guardian_consent_on = $3 where id = $1 returning *', [v.id, guardian, parseDate(flags.on) || today()]);
  out(flags, row, () => console.log(`Guardian consent for ${v.name} from ${guardian} recorded on ${d(row.guardian_consent_on)}.`));
}

// ---------------------------------------------------------------- applicants

async function cmdApplicants(db, args, flags) {
  if (args[0] === 'stage') return applicantStage(db, args.slice(1), flags);
  if (args[0] === 'decline') return applicantDecline(db, args.slice(1), flags);
  const rows = await db.query(`
    select v.ref, v.first_name || ' ' || v.last_name as name, v.stage, v.state, v.applied_on, v.interests, v.source,
           current_date - greatest(v.applied_on, v.interviewed_on, v.references_ok_on) as days_at_stage,
           (select string_agg(check_name(c.kind, c.jurisdiction) || ' ' || c.state, ', ') from v_checks c where c.volunteer_id = v.id) as checks
      from volunteers v where v.status = 'applicant'
     order by array_position(array['applied','interviewed','references','checks','inducted','done'], v.stage), v.applied_on`);
  out(flags, rows, () => {
    console.log(heading('Applicants, by screening stage'));
    console.log(table(rows, [
      { key: 'ref', label: 'ref' }, { key: 'name', label: 'name' }, { key: 'stage', label: 'stage' }, { key: 'state', label: 'state' },
      { key: 'applied_on', label: 'applied', format: d }, { key: 'days_at_stage', label: 'days at stage', align: 'right' },
      { key: 'interests', label: 'interests', width: 24 }, { key: 'checks', label: 'checks', width: 50 },
    ]));
  });
}

async function applicantStage(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  if (v.status !== 'applicant') throw new CliError(`${v.name} is ${v.status}, not an applicant.`);
  const to = str(flags.to).toLowerCase();
  if (!STAGES.includes(to)) throw new CliError(`--to must be one of: ${STAGES.join(', ')}.`);
  const on = parseDate(flags.on) || today();
  const sets = ['stage = $2'];
  if (to === 'interviewed' || STAGES.indexOf(to) > 1) sets.push('interviewed_on = coalesce(interviewed_on, $3)');
  if (STAGES.indexOf(to) > 2) sets.push('references_ok_on = coalesce(references_ok_on, $3)');
  const [row] = await db.query(`update volunteers set ${sets.join(', ')} where id = $1 returning *`, [v.id, to, on]);
  if (to === 'inducted') {
    await db.query("insert into training (volunteer_id, course, completed_on) values ($1, 'induction', $2) on conflict do nothing", [v.id, on]);
  }
  out(flags, row, () => {
    console.log(`${v.name} moved to "${to}".`);
    if (to === 'inducted' || to === 'done') console.log(`  Next: volunteers activate ${v.ref}`);
  });
}

async function applicantDecline(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  const reason = str(flags.reason);
  if (!reason) throw new CliError('Why? --reason="Police check outcome". It stays on the record, never in a draft to the applicant.');
  const [row] = await db.query("update volunteers set status = 'declined', ended_on = $2, end_reason = $3 where id = $1 returning *", [v.id, today(), reason]);
  out(flags, row, () => console.log(`${v.name}'s application is closed: ${reason}.`));
}

// ---------------------------------------------------------------- checks and training

async function cmdChecks(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return checkAdd(db, args.slice(1), flags);
  if (sub === 'verify') return checkVerify(db, args.slice(1), flags);
  if (sub === 'outcome') return checkOutcome(db, args.slice(1), flags);
  const days = num(flags.days || 60);
  const where = flags.all ? "volunteer_status in ('active', 'applicant', 'inactive')"
    : `volunteer_status in ('active', 'applicant') and (state not in ('CURRENT', 'WITHDRAWN') or good_until <= current_date + ${days})`;
  const rows = await db.query(`select volunteer_ref, volunteer, volunteer_status, check_name(kind, jurisdiction) as check, number, good_until,
                                      good_until - current_date as days_left, verified_on, state
                                 from v_checks c where ${where}
                                  and not (state = 'EXPIRED' and exists (select 1 from v_checks c2 where c2.volunteer_id = c.volunteer_id and c2.kind = c.kind and c2.state in ('CURRENT', 'EXPIRING', 'NOT VERIFIED')))
                                order by array_position(array['BARRED','EXPIRED','NOT VERIFIED','PENDING','EXPIRING','CURRENT'], state), good_until nulls last`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'Every check' : `Checks to act on, and anything expiring inside ${days} days`));
    console.log(table(rows, [
      { key: 'state', label: 'state' }, { key: 'volunteer_ref', label: 'ref' }, { key: 'volunteer', label: 'volunteer' }, { key: 'volunteer_status', label: 'status' },
      { key: 'check', label: 'check' }, { key: 'number', label: 'number' }, { key: 'good_until', label: 'good until', format: d },
      { key: 'days_left', label: 'days', align: 'right' }, { key: 'verified_on', label: 'verified', format: d },
    ]));
  });
}

// The same words as check_name() in the schema.
function checkLabel(kind, jurisdiction) {
  if (kind === 'wwcc') return jurisdiction === 'QLD' ? 'QLD blue card' : jurisdiction ? `${jurisdiction} Working with Children check` : 'Working with Children check';
  if (kind === 'police') return jurisdiction === 'NZ' ? 'NZ Police vet' : 'police check';
  if (kind === 'licence') return 'driver licence';
  return kind || 'check';
}

const KINDS = { wwcc: 'wwcc', 'working with children': 'wwcc', 'blue card': 'wwcc', bluecard: 'wwcc', police: 'police', 'police check': 'police', vet: 'police', licence: 'licence', license: 'licence', 'driver licence': 'licence' };

async function checkAdd(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' ') || flags.volunteer);
  const kind = KINDS[str(flags.kind).toLowerCase()] || (str(flags.kind) ? 'other' : null);
  if (!kind) throw new CliError('Which check? --kind=wwcc|police|licence.');
  const jurisdiction = str(flags.jurisdiction || flags.state).toUpperCase() || (kind === 'police' ? 'National' : null);
  if (kind === 'wwcc' && !jurisdiction) throw new CliError('A Working with Children check belongs to one state: --jurisdiction=NSW (or QLD, VIC...).');
  const [row] = await db.query(`insert into checks (volunteer_id, kind, jurisdiction, number, issued_on, expires_on, outcome, note)
                                 values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
  [v.id, kind, jurisdiction, str(flags.number) || null, parseDate(flags.issued) || today(), parseDate(flags.expires, 'expiry date'), str(flags.outcome) || 'clear', str(flags.note) || null]);
  out(flags, row, () => console.log(`Recorded ${checkLabel(kind, jurisdiction)} ${row.number || ''} for ${v.name}. It does not count until verified: checks verify ${v.ref} ${row.number || ''} --by="<you>"`));
}

async function findCheck(db, v, number) {
  const rows = number
    ? await db.query('select * from checks where volunteer_id = $1 and (upper(number) = upper($2) or kind = $3) order by issued_on desc', [v.id, number, KINDS[number.toLowerCase()] || '-'])
    : await db.query('select * from checks where volunteer_id = $1 and verified_on is null order by issued_on desc', [v.id]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new CliError(`No matching check for ${v.name}.`);
  throw new CliError(`${v.name} has ${rows.length} matching checks. Give the number:\n${rows.map((r) => `  ${checkLabel(r.kind, r.jurisdiction)} ${r.number || ''}`).join('\n')}`);
}

async function checkVerify(db, args, flags) {
  const v = await resolveVolunteer(db, args[0]);
  const c = await findCheck(db, v, args[1] || str(flags.number));
  const by = await resolveStaff(db, flags.by);
  if (!by) throw new CliError('Who verified it with the issuer? --by="Rachel Moss". A check is only as good as the person who looked it up.');
  const [row] = await db.query('update checks set verified_on = $2, verified_by = $3 where id = $1 returning *', [c.id, parseDate(flags.on) || today(), by.id]);
  out(flags, row, () => console.log(`${v.name}'s ${checkLabel(c.kind, c.jurisdiction)} ${c.number || ''} verified by ${by.name} on ${d(row.verified_on)}.`));
}

async function checkOutcome(db, args, flags) {
  const v = await resolveVolunteer(db, args[0]);
  const c = await findCheck(db, v, args[1] || str(flags.number));
  const outcome = str(flags.to).toLowerCase();
  if (!['clear', 'pending', 'barred', 'withdrawn'].includes(outcome)) throw new CliError('--to must be clear, pending, barred or withdrawn.');
  const [row] = await db.query('update checks set outcome = $2 where id = $1 returning *', [c.id, outcome]);
  let cancelled = [];
  if (outcome === 'barred') {
    cancelled = await db.query(`update assignments a set status = 'cancelled' from shifts s where s.id = a.shift_id and a.volunteer_id = $1
                                 and a.status in ('rostered', 'confirmed') and s.shift_on >= current_date returning s.ref`, [v.id]);
  }
  out(flags, { check: row, cancelled: cancelled.map((x) => x.ref) }, () => {
    console.log(`${v.name}'s ${checkLabel(c.kind, c.jurisdiction)} ${c.number || ''} is now ${outcome}.`);
    if (cancelled.length) console.log(`  taken off ${cancelled.map((x) => x.ref).join(', ')}.`);
    if (outcome === 'barred') console.log('  Decide on the application with your safeguarding lead. Nothing about the outcome goes in a draft to the volunteer.');
  });
}

async function cmdTraining(db, args, flags) {
  if (args[0] === 'add') return trainingAdd(db, args.slice(1), flags);
  const rows = await db.query(`
    select v.ref, v.first_name || ' ' || v.last_name as name, t.course, t.completed_on, t.expires_on, t.expires_on - current_date as days_left, t.state
      from v_training t join volunteers v on v.id = t.volunteer_id
     where v.status = 'active' ${flags.course ? 'and t.course = $1' : ''} ${flags.all ? '' : "and t.state <> 'CURRENT'"}
     order by array_position(array['EXPIRED','EXPIRING','CURRENT'], t.state), t.expires_on nulls last, v.ref`, flags.course ? [str(flags.course)] : []);
  const missing = await db.query(`
    select distinct v.ref, v.first_name || ' ' || v.last_name as name, r.name as role, k as course
      from assignments a join shifts s on s.id = a.shift_id join roles r on r.id = s.role_id join volunteers v on v.id = a.volunteer_id
      cross join unnest(r.required_training) k
     where v.status = 'active' and s.shift_on >= current_date - 90
       and not exists (select 1 from training t where t.volunteer_id = v.id and t.course = k)
     order by v.ref`);
  out(flags, { training: rows, never_done: missing }, () => {
    console.log(heading(flags.all ? 'Training on record' : 'Training expired or expiring'));
    console.log(table(rows, [{ key: 'state', label: 'state' }, { key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'course', label: 'course' },
      { key: 'completed_on', label: 'completed', format: d }, { key: 'expires_on', label: 'expires', format: d }, { key: 'days_left', label: 'days', align: 'right' }]));
    if (missing.length) {
      console.log(heading('Working a role without its course on record'));
      console.log(table(missing, [{ key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'role', label: 'role' }, { key: 'course', label: 'missing course' }]));
    }
  });
}

async function trainingAdd(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' ') || flags.volunteer);
  const course = str(flags.course).toLowerCase().replace(/\s+/g, '-');
  if (!course) throw new CliError('Which course? --course=food-safety (induction, child-safe, manual-handling, infection-control, first-aid...).');
  const on = parseDate(flags.on) || today();
  let expires = parseDate(flags.expires, 'expiry date');
  if (!expires && flags.years) expires = addDays(on, Math.round(Number(flags.years) * 365.25));
  const [row] = await db.query(`insert into training (volunteer_id, course, completed_on, expires_on) values ($1, $2, $3, $4)
                                 on conflict (volunteer_id, course, completed_on) do update set expires_on = excluded.expires_on returning *`, [v.id, course, on, expires]);
  out(flags, row, () => console.log(`${v.name} completed ${course} on ${d(on)}${expires ? `, good until ${d(expires)}` : ''}.`));
}

// ---------------------------------------------------------------- shifts and the roster

async function cmdShifts(db, args, flags) {
  if (args[0] === 'add') return shiftAdd(db, flags);
  if (args[0] === 'cancel') return shiftCancel(db, args.slice(1), flags);
  const days = num(flags.days || 14);
  const rows = await db.query(`select s.*, (select string_agg(v.first_name || ' ' || left(v.last_name, 1) || case when a.status = 'rostered' then '?' else '' end, ', ' order by v.first_name)
                                       from assignments a join volunteers v on v.id = a.volunteer_id where a.shift_id = s.shift_id and a.status in ('rostered', 'confirmed')) as who,
                                      (select count(*) from v_roster_problems p where p.shift = s.ref)::int as problems
                                 from v_shifts s where s.status = 'open' and s.shift_on between current_date and current_date + $1::int
                                 ${flags.program ? 'and s.program ilike $2' : ''}
                                order by s.shift_on, s.starts`, flags.program ? [days, `%${flags.program}%`] : [days]);
  out(flags, rows, () => {
    console.log(heading(`Shifts in the next ${days} days (? = not confirmed)`));
    console.log(table(rows, [
      { key: 'ref', label: 'shift' }, { key: 'shift_on', label: 'date', format: d }, { key: 'starts', label: 'from', format: t5 }, { key: 'ends', label: 'to', format: t5 },
      { key: 'role', label: 'role', width: 22 }, { key: 'location', label: 'where', width: 22 },
      { key: 'filled', label: 'filled', align: 'right', format: (v, r) => `${v}/${r.needed}` },
      { key: 'who', label: 'who', width: 40 }, { key: 'problems', label: 'not cleared', align: 'right', format: (v) => (num(v) ? v : '') },
    ]));
  });
}

async function shiftAdd(db, flags) {
  const role = await resolveRole(db, flags.role);
  const on = parseDate(flags.on);
  if (!on) throw new CliError('Which day? --on=2026-10-18 (or +7).');
  const starts = parseTime(flags.starts, 'starts');
  const ends = parseTime(flags.ends, 'ends');
  if (ends <= starts) throw new CliError('The shift has to end after it starts.');
  const count = Math.max(1, num(flags.weeks || 1));
  const made = [];
  for (let i = 0; i < count; i++) {
    const ref = await nextRef(db, 'shifts', 'SH', 2001);
    const [row] = await db.query(`insert into shifts (ref, role_id, location, shift_on, starts, ends, needed, note) values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
      [ref, role.id, str(flags.location) || null, addDays(on, i * 7), starts, ends, Math.max(1, num(flags.needed || 1)), str(flags.note) || null]);
    made.push(row);
  }
  out(flags, made, () => console.log(`Added ${made.length} ${role.name} shift(s): ${made.map((s) => `${s.ref} ${d(s.shift_on)}`).join(', ')}. Fill it: gaps`));
}

async function shiftCancel(db, args, flags) {
  const s = await resolveShift(db, args[0]);
  await db.query("update shifts set status = 'cancelled', note = coalesce($2, note) where id = $1", [s.shift_id, str(flags.reason) || null]);
  const told = await db.query(`select v.ref, v.first_name || ' ' || v.last_name as name, v.phone from assignments a join volunteers v on v.id = a.volunteer_id
                                where a.shift_id = $1 and a.status in ('rostered', 'confirmed')`, [s.shift_id]);
  await db.query("update assignments set status = 'cancelled' where shift_id = $1 and status in ('rostered', 'confirmed')", [s.shift_id]);
  out(flags, { shift: s.ref, to_tell: told }, () => {
    console.log(`${s.ref} (${s.role}, ${d(s.shift_on)}) cancelled.`);
    if (told.length) console.log(`  Tell: ${told.map((t) => `${t.name} ${t.phone || ''}`.trim()).join('; ')}`);
  });
}

async function cmdRoster(db, args, flags) {
  const s = await resolveShift(db, args[0]);
  const v = await resolveVolunteer(db, args.slice(1).join(' ') || flags.volunteer);
  if (s.status !== 'open') throw new CliError(`${s.ref} is ${s.status}.`);
  if (isoDate(s.shift_on) < today()) throw new CliError(`${s.ref} was on ${d(s.shift_on)}. Record what happened with attend.`);
  const [clash] = await db.query(`select s.ref, s.role from assignments a join v_shifts s on s.shift_id = a.shift_id
                                   where a.volunteer_id = $1 and a.status in ('rostered', 'confirmed') and s.shift_on = $2 and s.shift_id <> $5
                                     and s.starts < $4::time and s.ends > $3::time`, [v.id, isoDate(s.shift_on), s.starts, s.ends, s.shift_id]);
  if (clash) throw new CliError(`${v.name} is already on ${clash.ref} (${clash.role}) at that time.`);
  const problems = (await db.query('select * from clearance_problems($1, $2, $3) as p(problem)', [v.id, s.role_id, isoDate(s.shift_on)])).map((r) => r.problem);
  if (problems.length) throw new CliError(`${v.name} is not cleared for ${s.role} on ${d(s.shift_on)}:\n${problems.map((p) => `  - ${p}`).join('\n')}\nFix the record first. There is no override.`);
  const [existing] = await db.query('select * from assignments where shift_id = $1 and volunteer_id = $2', [s.shift_id, v.id]);
  if (existing && ['rostered', 'confirmed'].includes(existing.status)) throw new CliError(`${v.name} is already on ${s.ref}.`);
  if (s.gap <= 0) throw new CliError(`${s.ref} already has the ${s.needed} it needs.`);
  const status = flags.confirmed ? 'confirmed' : 'rostered';
  const [row] = await db.query(`insert into assignments (shift_id, volunteer_id, status, confirmed_on) values ($1, $2, $3, $4)
                                 on conflict (shift_id, volunteer_id) do update set status = excluded.status, rostered_on = current_date, confirmed_on = excluded.confirmed_on returning *`,
  [s.shift_id, v.id, status, status === 'confirmed' ? today() : null]);
  out(flags, row, () => console.log(`${v.name} is on ${s.ref}, ${s.role}, ${d(s.shift_on)} ${t5(s.starts)}-${t5(s.ends)} (${status}). ${s.filled + 1} of ${s.needed}.`));
}

async function cmdConfirm(db, args, flags) {
  const s = await resolveShift(db, args[0]);
  const v = await resolveVolunteer(db, args.slice(1).join(' '));
  const rows = await db.query("update assignments set status = 'confirmed', confirmed_on = current_date where shift_id = $1 and volunteer_id = $2 and status = 'rostered' returning *", [s.shift_id, v.id]);
  if (!rows.length) throw new CliError(`${v.name} is not waiting to confirm ${s.ref}.`);
  out(flags, rows[0], () => console.log(`${v.name} confirmed for ${s.ref} on ${d(s.shift_on)}.`));
}

async function cmdUnroster(db, args, flags) {
  const s = await resolveShift(db, args[0]);
  const v = await resolveVolunteer(db, args.slice(1).join(' '));
  const rows = await db.query("update assignments set status = 'cancelled' where shift_id = $1 and volunteer_id = $2 and status in ('rostered', 'confirmed') returning *", [s.shift_id, v.id]);
  if (!rows.length) throw new CliError(`${v.name} is not on ${s.ref}.`);
  out(flags, rows[0], () => console.log(`${v.name} is off ${s.ref}. ${s.ref} now has ${s.filled - 1} of ${s.needed}.`));
}

// Record who came. Everyone rostered or confirmed attended, except --absent.
// Attendance writes the hours, approved.
async function cmdAttend(db, args, flags) {
  const s = await resolveShift(db, args[0]);
  if (isoDate(s.shift_on) > today()) throw new CliError(`${s.ref} is on ${d(s.shift_on)}. Attendance is recorded on the day or after.`);
  const absent = new Set();
  for (const name of str(flags.absent).split(',').map((x) => x.trim()).filter(Boolean)) absent.add((await resolveVolunteer(db, name)).id);
  const by = await staffOrDefault(db, flags);
  const rows = await db.query(`select a.id, a.volunteer_id, v.first_name || ' ' || v.last_name as name from assignments a join volunteers v on v.id = a.volunteer_id
                                where a.shift_id = $1 and a.status in ('rostered', 'confirmed')`, [s.shift_id]);
  if (!rows.length) throw new CliError(`Nobody is waiting to be marked on ${s.ref}.`);
  const result = { attended: [], no_show: [] };
  for (const r of rows) {
    if (absent.has(r.volunteer_id)) {
      await db.query("update assignments set status = 'no-show' where id = $1", [r.id]);
      result.no_show.push(r.name);
    } else {
      await db.query("update assignments set status = 'attended' where id = $1", [r.id]);
      await db.query(`insert into hours (volunteer_id, program_id, role_id, assignment_id, worked_on, minutes, activity, source, approved_on, approved_by)
                      values ($1, $2, $3, $4, $5, $6, $7, 'shift', current_date, $8) on conflict (assignment_id) do nothing`,
      [r.volunteer_id, s.program_id, s.role_id, r.id, isoDate(s.shift_on), s.minutes, s.role, by?.id || null]);
      result.attended.push(r.name);
    }
  }
  out(flags, result, () => console.log(`${s.ref}: ${result.attended.length} attended (${h(s.minutes * result.attended.length)} recorded)${result.no_show.length ? `, no-show: ${result.no_show.join(', ')}` : ''}.`));
}

// Open places in the coming days, and who could fill each: active, cleared for
// the role on that day, not already working, ordered by who works that role most.
async function cmdGaps(db, flags) {
  const days = num(flags.days || 14);
  const shifts = await db.query("select * from v_shifts where status = 'open' and gap > 0 and shift_on between current_date and current_date + $1::int order by shift_on, starts", [days]);
  const result = [];
  for (const s of shifts) {
    const candidates = await db.query(`
      select v.ref, v.first_name || ' ' || v.last_name as name, v.phone, v.availability,
             (select count(*) from hours x where x.volunteer_id = v.id and x.role_id = $1 and x.worked_on >= current_date - 180)::int as times_in_role,
             (select max(x.worked_on) from hours x where x.volunteer_id = v.id) as last_on
        from volunteers v
       where v.status = 'active'
         and not exists (select 1 from clearance_problems(v.id, $1, $2::date))
         and not exists (select 1 from assignments a join shifts o on o.id = a.shift_id
                          where a.volunteer_id = v.id and a.status in ('rostered', 'confirmed') and o.shift_on = $2::date and o.starts < $4::time and o.ends > $3::time)
       order by 5 desc, v.ref limit 5`, [s.role_id, isoDate(s.shift_on), s.starts, s.ends]);
    result.push({ ...s, candidates });
  }
  out(flags, result, () => {
    console.log(heading(`Open places in the next ${days} days, and who is cleared to fill them`));
    if (!result.length) console.log('  Every shift is full.');
    for (const s of result) {
      console.log(`\n  ${s.ref}  ${d(s.shift_on)} ${t5(s.starts)}-${t5(s.ends)}  ${s.role}, ${s.location || s.program}: ${s.filled} of ${s.needed}, ${s.gap} open`);
      if (!s.candidates.length) console.log('    nobody active is cleared for this role that day');
      for (const c of s.candidates) console.log(`    ${c.ref}  ${c.name.padEnd(20)} ${String(c.times_in_role).padStart(2)} times in this role in 6 months  ${c.availability || ''}  ${c.phone || ''}`);
    }
  });
}

// ---------------------------------------------------------------- hours

async function cmdHours(db, args, flags) {
  if (args[0] === 'log') return hoursLog(db, args.slice(1), flags);
  if (args[0] === 'approve') return hoursApprove(db, args.slice(1), flags);
  if (args[0] === 'pending') return hoursPending(db, flags);
  const { from, to } = flags.month ? parseMonth(flags.month) : { from: addDays(today(), -num(flags.days || 30)), to: today() };
  const byProgram = await db.query(`select p.name as program, count(distinct h.volunteer_id)::int as volunteers, count(*)::int as entries, sum(h.minutes)::int as minutes
                                      from hours h join programs p on p.id = h.program_id
                                     where h.approved_on is not null and h.worked_on between $1 and $2 group by p.name order by 4 desc`, [from, to]);
  const top = await db.query(`select v.ref, v.first_name || ' ' || v.last_name as name, sum(h.minutes)::int as minutes, count(*)::int as entries
                                from hours h join volunteers v on v.id = h.volunteer_id
                               where h.approved_on is not null and h.worked_on between $1 and $2 group by v.id order by 3 desc limit 10`, [from, to]);
  const [pending] = await db.query('select count(*)::int as entries, coalesce(sum(minutes), 0)::int as minutes from hours where approved_on is null');
  const total = byProgram.reduce((a, r) => a + num(r.minutes), 0);
  out(flags, { from, to, total_minutes: total, by_program: byProgram, top_volunteers: top, pending }, () => {
    console.log(heading(`Hours given, ${from} to ${to}: ${h(total)}`));
    console.log(table(byProgram, [{ key: 'program', label: 'program' }, { key: 'volunteers', label: 'volunteers', align: 'right' }, { key: 'entries', label: 'entries', align: 'right' }, { key: 'minutes', label: 'hours', align: 'right', format: h }]));
    console.log(heading('Most hours'));
    console.log(table(top, [{ key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'entries', label: 'entries', align: 'right' }, { key: 'minutes', label: 'hours', align: 'right', format: h }]));
    if (pending.entries) console.log(`\n  ${pending.entries} entr(ies), ${h(pending.minutes)}, waiting for approval and not counted: hours pending`);
  });
}

async function hoursLog(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' ') || flags.volunteer);
  let role = null;
  let program;
  if (flags.role) { role = await resolveRole(db, flags.role); [program] = await db.query('select * from programs where id = $1', [role.program_id]); }
  else program = await resolveProgram(db, flags.program);
  const on = parseDate(flags.on) || today();
  if (on > today()) throw new CliError('Hours are logged after they are given, not before.');
  const minutes = parseHours(flags.hours);
  if (minutes > 960) throw new CliError('More than 16 hours in one entry. Split it by day.');
  const [already] = await db.query('select coalesce(sum(minutes), 0)::int as m from hours where volunteer_id = $1 and worked_on = $2', [v.id, on]);
  if (already.m + minutes > 960) throw new CliError(`${v.name} already has ${h(already.m)} on ${on}. Over 16 hours in a day is a typing slip, not a shift.`);
  const approver = flags.approve ? await staffOrDefault(db, flags) : null;
  const [row] = await db.query(`insert into hours (volunteer_id, program_id, role_id, worked_on, minutes, activity, source, approved_on, approved_by)
                                 values ($1, $2, $3, $4, $5, $6, 'self', $7, $8) returning *`,
  [v.id, program.id, role?.id || null, on, minutes, str(flags.activity) || role?.name || null, approver ? today() : null, approver?.id || null]);
  out(flags, row, () => console.log(`${h(minutes)} for ${v.name} on ${on} in ${program.name}${approver ? `, approved by ${approver.name}` : ', waiting for approval'}.`));
}

async function hoursPending(db, flags) {
  const rows = await db.query(`select v.ref, v.first_name || ' ' || v.last_name as name, p.name as program, h.worked_on, h.minutes, h.activity, current_date - h.worked_on as days
                                 from hours h join volunteers v on v.id = h.volunteer_id join programs p on p.id = h.program_id
                                where h.approved_on is null order by h.worked_on`);
  out(flags, rows, () => {
    console.log(heading('Hours waiting for approval'));
    console.log(table(rows, [{ key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'program', label: 'program' }, { key: 'worked_on', label: 'date', format: d },
      { key: 'minutes', label: 'hours', align: 'right', format: h }, { key: 'activity', label: 'activity', width: 40 }, { key: 'days', label: 'waiting', align: 'right' }]));
  });
}

async function hoursApprove(db, args, flags) {
  const by = await resolveStaff(db, flags.by);
  if (!by) throw new CliError('Who is approving? --by="Rachel Moss".');
  let rows;
  if (flags.all) rows = await db.query('update hours set approved_on = current_date, approved_by = $1 where approved_on is null returning *', [by.id]);
  else {
    const v = await resolveVolunteer(db, args.join(' '));
    rows = await db.query('update hours set approved_on = current_date, approved_by = $2 where approved_on is null and volunteer_id = $1 returning *', [v.id, by.id]);
  }
  const minutes = rows.reduce((a, r) => a + num(r.minutes), 0);
  out(flags, { approved: rows.length, minutes }, () => console.log(`${rows.length} entr(ies), ${h(minutes)}, approved by ${by.name}.`));
}

// ---------------------------------------------------------------- recognition and retention

async function cmdMilestones(db, flags) {
  const rows = await db.query(`select m.ref, m.name, m.milestone, v.minutes_total, v.started_on from v_milestones m join v_volunteers v on v.volunteer_id = m.volunteer_id order by m.ref, m.threshold nulls first`);
  out(flags, rows, () => {
    console.log(heading('Milestones reached and not yet recognised'));
    console.log(table(rows, [{ key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'milestone', label: 'milestone' },
      { key: 'minutes_total', label: 'hours to date', align: 'right', format: h }, { key: 'started_on', label: 'started', format: d }]));
  });
}

async function cmdRecognise(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' '));
  const milestone = str(flags.milestone);
  if (!milestone) {
    const due = await db.query('select milestone from v_milestones where volunteer_id = $1', [v.id]);
    throw new CliError(`Which milestone? --milestone="${due[0]?.milestone || '100 hours'}"${due.length ? `. Due: ${due.map((m) => m.milestone).join(', ')}` : ''}`);
  }
  const [row] = await db.query(`insert into recognitions (volunteer_id, milestone, awarded_on, how) values ($1, $2, $3, $4)
                                 on conflict (volunteer_id, milestone) do update set awarded_on = excluded.awarded_on, how = excluded.how returning *`,
  [v.id, milestone, parseDate(flags.on) || today(), str(flags.how) || null]);
  out(flags, row, () => console.log(`${milestone} recognised for ${v.name} on ${d(row.awarded_on)}${row.how ? `: ${row.how}` : ''}.`));
}

async function cmdLapsing(db, flags) {
  const rows = await db.query(`
    select v.ref, v.name, v.phone, v.last_shift_on, v.last_hours_on, greatest(v.last_shift_on, v.last_hours_on, v.started_on) as last_seen,
           current_date - greatest(v.last_shift_on, v.last_hours_on, v.started_on) as days, v.minutes_total,
           (select n.body from notes n where n.volunteer_id = v.volunteer_id order by n.noted_on desc limit 1) as last_note
      from v_volunteers v cross join settings s
     where v.status = 'active' and v.next_shift_on is null
       and greatest(v.last_shift_on, v.last_hours_on, v.started_on) <= current_date - coalesce($1::int, s.quiet_after_days)
     order by days desc`, [flags.days ? num(flags.days) : null]);
  out(flags, rows, () => {
    console.log(heading('Active volunteers who have quietly stopped coming'));
    console.log(table(rows, [{ key: 'ref', label: 'ref' }, { key: 'name', label: 'volunteer' }, { key: 'last_seen', label: 'last seen', format: d }, { key: 'days', label: 'days', align: 'right' },
      { key: 'minutes_total', label: 'all time', align: 'right', format: h }, { key: 'phone', label: 'phone' }, { key: 'last_note', label: 'last note', width: 60 }]));
  });
}

// ---------------------------------------------------------------- incidents

async function cmdIncidents(db, args, flags) {
  const sub = args[0];
  if (sub === 'add') return incidentAdd(db, flags);
  if (sub === 'notify') return incidentNotify(db, args.slice(1), flags);
  if (sub === 'close') return incidentClose(db, args.slice(1), flags);
  const rows = await db.query(`select i.ref, i.occurred_on, i.kind, p.name as program, v.first_name || ' ' || v.last_name as volunteer, i.description, i.notifiable, i.notified_on, i.actions, i.closed_on,
                                      current_date - i.occurred_on as days
                                 from incidents i left join programs p on p.id = i.program_id left join volunteers v on v.id = i.volunteer_id
                                ${flags.all ? '' : 'where i.closed_on is null'} order by (i.notifiable and i.notified_on is null) desc, i.occurred_on desc`);
  out(flags, rows, () => {
    console.log(heading(flags.all ? 'Incidents' : 'Open incidents'));
    console.log(table(rows, [{ key: 'ref', label: 'ref' }, { key: 'occurred_on', label: 'date', format: d }, { key: 'kind', label: 'kind' }, { key: 'program', label: 'program' },
      { key: 'volunteer', label: 'volunteer' }, { key: 'notifiable', label: 'notifiable', format: (v, r) => (v ? (r.notified_on ? `told ${d(r.notified_on)}` : 'NOT YET TOLD') : '') },
      { key: 'description', label: 'what happened', width: 60 }, { key: 'closed_on', label: 'closed', format: d }]));
  });
}

async function incidentAdd(db, flags) {
  const kind = str(flags.kind).toLowerCase();
  if (!['injury', 'near miss', 'complaint', 'safeguarding', 'property'].includes(kind)) throw new CliError('--kind must be injury, "near miss", complaint, safeguarding or property.');
  const description = str(flags.description || flags.what);
  if (!description) throw new CliError('What happened? --what="..."');
  const v = flags.volunteer ? await resolveVolunteer(db, flags.volunteer) : null;
  const p = flags.program ? await resolveProgram(db, flags.program) : null;
  const ref = await nextRef(db, 'incidents', 'INC', 1);
  const [row] = await db.query(`insert into incidents (ref, occurred_on, program_id, volunteer_id, kind, description, notifiable) values ($1, $2, $3, $4, $5, $6, $7) returning *`,
    [ref.replace(/INC-(\d)$/, 'INC-0$1'), parseDate(flags.on) || today(), p?.id || null, v?.id || null, kind, description, !!flags.notifiable]);
  out(flags, row, () => {
    console.log(`Recorded ${row.ref}: ${kind}${v ? `, ${v.name}` : ''}.`);
    if (row.notifiable) console.log('  NOTIFIABLE: tell the regulator immediately (SafeWork in your state, or WorkSafe in New Zealand), keep the site as it is, then: incidents notify ' + row.ref);
    else if (kind === 'injury') console.log('  If it was a death, a serious injury or illness (admitted to hospital, for example) or a dangerous incident, it is notifiable: see docs/compliance.md.');
  });
}

async function incidentNotify(db, args, flags) {
  const [i] = await db.query('select * from incidents where upper(ref) = upper($1)', [args[0] || '']);
  if (!i) throw new CliError(`No incident "${args[0]}".`);
  const [row] = await db.query('update incidents set notifiable = true, notified_on = $2, actions = coalesce(actions || $3, actions, $4) where id = $1 returning *',
    [i.id, parseDate(flags.on) || today(), flags.reference ? `; regulator reference ${flags.reference}` : null, flags.reference ? `Regulator reference ${flags.reference}` : null]);
  out(flags, row, () => console.log(`${row.ref}: regulator told on ${d(row.notified_on)}.`));
}

async function incidentClose(db, args, flags) {
  const [i] = await db.query('select * from incidents where upper(ref) = upper($1)', [args[0] || '']);
  if (!i) throw new CliError(`No incident "${args[0]}".`);
  if (i.notifiable && !i.notified_on) throw new CliError(`${i.ref} is notifiable and the regulator has not been told. Record it first: incidents notify ${i.ref} --on=<date>`);
  const actions = str(flags.actions);
  if (!actions && !i.actions) throw new CliError('What was done about it? --actions="Ramp resurfaced, non-slip mats down".');
  const [row] = await db.query('update incidents set closed_on = $2, actions = coalesce($3, actions) where id = $1 returning *', [i.id, parseDate(flags.on) || today(), actions || null]);
  out(flags, row, () => console.log(`${row.ref} closed: ${row.actions}.`));
}

// ---------------------------------------------------------------- notes, funder report, compliance

async function cmdLog(db, args, flags) {
  const v = await resolveVolunteer(db, args.join(' ') || flags.volunteer);
  const body = str(flags.body || flags.note);
  if (!body) throw new CliError('What happened? --body="Called about Saturday, will come at 10".');
  const kind = str(flags.kind) || 'note';
  if (!['call', 'email', 'meeting', 'note'].includes(kind)) throw new CliError('--kind must be call, email, meeting or note.');
  const by = await resolveStaff(db, flags.by);
  const [row] = await db.query('insert into notes (volunteer_id, staff_id, noted_on, kind, body) values ($1, $2, $3, $4, $5) returning *', [v.id, by?.id || null, parseDate(flags.on) || today(), kind, body]);
  out(flags, row, () => console.log(`Logged a ${kind} against ${v.name}.`));
}

// The hours a funder asks for: by program and month, volunteers counted once.
async function cmdFunder(db, flags) {
  const program = flags.program ? await resolveProgram(db, flags.program) : null;
  const [s] = await db.query('select * from settings');
  let from = parseDate(flags.from);
  let to = parseDate(flags.to);
  if (!from) {
    const now = new Date();
    const fyStartYear = now.getMonth() + 1 >= s.fy_start_month ? now.getFullYear() : now.getFullYear() - 1;
    from = `${fyStartYear}-${String(s.fy_start_month).padStart(2, '0')}-01`;
  }
  if (!to) to = today();
  const params = [from, to];
  const pf = program ? (params.push(program.id), `and h.program_id = $${params.length}`) : '';
  const months = await db.query(`select p.name as program, to_char(date_trunc('month', h.worked_on), 'Mon YYYY') as month, date_trunc('month', h.worked_on)::date as period,
                                        count(distinct h.volunteer_id)::int as volunteers, sum(h.minutes)::int as minutes
                                   from hours h join programs p on p.id = h.program_id
                                  where h.approved_on is not null and h.worked_on between $1 and $2 ${pf}
                                  group by p.name, date_trunc('month', h.worked_on) order by p.name, period`, params);
  const totals = await db.query(`select p.name as program, p.funder, count(distinct h.volunteer_id)::int as volunteers, sum(h.minutes)::int as minutes,
                                        count(distinct h.volunteer_id) filter (where v.started_on >= $1)::int as new_volunteers
                                   from hours h join programs p on p.id = h.program_id join volunteers v on v.id = h.volunteer_id
                                  where h.approved_on is not null and h.worked_on between $1 and $2 ${pf}
                                  group by p.name, p.funder order by 4 desc`, params);
  const value = s.hour_value_cents ? totals.map((t) => ({ program: t.program, value_cents: Math.round((t.minutes / 60) * s.hour_value_cents) })) : null;
  out(flags, { from, to, program: program?.name || 'all', totals, months, hour_value_cents: s.hour_value_cents, value }, () => {
    console.log(heading(`Volunteer hours for funders, ${from} to ${to}${program ? `: ${program.name}` : ''}`));
    console.log(table(totals, [{ key: 'program', label: 'program' }, { key: 'funder', label: 'funder', width: 40 }, { key: 'volunteers', label: 'volunteers', align: 'right' },
      { key: 'new_volunteers', label: 'new', align: 'right' }, { key: 'minutes', label: 'hours', align: 'right', format: h }]));
    console.log(heading('By month'));
    console.log(table(months, [{ key: 'program', label: 'program' }, { key: 'month', label: 'month' }, { key: 'volunteers', label: 'volunteers', align: 'right' }, { key: 'minutes', label: 'hours', align: 'right', format: h }]));
    if (!s.hour_value_cents) console.log('\n  No dollar value per hour is set, so none is shown. Your funder may name the rate to use: set settings.hour_value_cents with /customise.');
    console.log('  Approved hours only. Self-logged hours count once a coordinator approves them.');
  });
}

const RULES = [
  { id: 'wwcc-current', title: 'Everyone in child-related work holds a current, verified Working with Children check from the state the work is in',
    source: 'Child Protection (Working with Children) Act 2012 (NSW); Working with Children (Risk Management and Screening) Act 2000 (Qld); Worker Screening Act 2020 (Vic)',
    sql: `select distinct v.ref, v.first_name || ' ' || v.last_name as who, (s.shift_on - current_date) as days, s.ref || ' ' || s.role || ' ' || s.shift_on || ': ' || p.problem as detail
            from v_roster_problems p join volunteers v on v.ref = p.volunteer_ref join v_shifts s on s.ref = p.shift where p.problem like '%Working with Children%' or p.problem like '%blue card%'` },
  { id: 'wwcc-verified', title: 'A Working with Children check is verified online with the issuer before the volunteer starts, and recorded',
    source: 'Office of the Children\'s Guardian (NSW), employer verification; Blue Card Services (Qld); your screening policy',
    sql: `select volunteer_ref as ref, volunteer as who, (current_date - issued_on) as days, check_name(kind, jurisdiction) || ' ' || coalesce(number, '') || ' not verified' as detail
            from v_checks where kind = 'wwcc' and state = 'NOT VERIFIED' and volunteer_status in ('active', 'applicant')` },
  { id: 'roster-cleared', title: 'Nobody works a role without the checks and training it requires on the day',
    source: 'Work Health and Safety Act 2011 s19 (volunteers are workers under s7); Health and Safety at Work Act 2015 (NZ) s36 and s19; your role descriptions',
    sql: `select volunteer_ref as ref, volunteer as who, (shift_on - current_date) as days, shift || ' ' || role || ': ' || problem as detail from v_roster_problems
           where problem not like '%Working with Children%' and problem not like '%blue card%'` },
  { id: 'police-recheck', title: 'Police checks are renewed on your policy cycle (settings.police_recheck_years)',
    source: 'Your screening policy. In New Zealand the Children\'s Act 2014 three-yearly recheck covers paid children\'s workers; many organisations apply it to volunteers too',
    sql: `select volunteer_ref as ref, volunteer as who, (current_date - good_until) as days, check_name(kind, jurisdiction) || ' ran out ' || good_until as detail
            from v_checks c where kind = 'police' and state = 'EXPIRED' and volunteer_status = 'active'
             and not exists (select 1 from v_checks c2 where c2.volunteer_id = c.volunteer_id and c2.kind = 'police' and c2.state in ('CURRENT', 'EXPIRING', 'NOT VERIFIED'))` },
  { id: 'notifiable', title: 'A notifiable incident is reported to the regulator immediately',
    source: 'Work Health and Safety Act 2011 s35 to s38; Health and Safety at Work Act 2015 (NZ) s23 to s25 and s56',
    sql: `select ref, coalesce((select first_name || ' ' || last_name from volunteers v where v.id = i.volunteer_id), '') as who, (current_date - occurred_on) as days,
                 kind || ' on ' || occurred_on || ': ' || description as detail from incidents i where notifiable and notified_on is null` },
  { id: 'incident-records', title: 'Notifiable incident records are kept for at least five years',
    source: 'Work Health and Safety Act 2011 s38(7); Health and Safety at Work Act 2015 (NZ) s57',
    sql: `select ref, '' as who, (current_date - occurred_on) as days, 'notifiable incident record with no description of actions taken' as detail
            from incidents where notifiable and notified_on is not null and closed_on is not null and coalesce(actions, '') = ''` },
  { id: 'under-18-consent', title: 'Volunteers under 18 have a parent or guardian\'s consent on file',
    source: 'Your volunteer policy; National Standards for Volunteer Involvement (Volunteering Australia, 2015), Standard 4',
    sql: `select v.ref, v.name as who, v.age as days, 'aged ' || v.age || ', no consent on file' as detail from v_volunteers v join volunteers x on x.id = v.volunteer_id
           where v.status in ('active', 'applicant') and v.age < 18 and x.guardian_consent_on is null` },
  { id: 'induction', title: 'Every active volunteer has an induction on record',
    source: 'National Standards for Volunteer Involvement (Volunteering Australia, 2015), Standard 5; WHS Act 2011 s19(3)(f), information and training',
    sql: `select v.ref, v.first_name || ' ' || v.last_name as who, (current_date - v.started_on) as days, 'active since ' || v.started_on || ' with no induction' as detail
            from volunteers v where v.status = 'active' and not exists (select 1 from training t where t.volunteer_id = v.id and t.course = 'induction')` },
  { id: 'emergency-contact', title: 'Every active volunteer has an emergency contact',
    source: 'Your volunteer policy; WHS Regulations 2011 r43, emergency plans',
    sql: `select ref, first_name || ' ' || last_name as who, null::int as days, 'no emergency contact' as detail from volunteers where status = 'active' and coalesce(emergency_contact, '') = ''` },
  { id: 'barred', title: 'Anyone with a barring outcome is not active and not rostered',
    source: 'Child Protection (Working with Children) Act 2012 (NSW); Working with Children (Risk Management and Screening) Act 2000 (Qld); your safeguarding policy',
    sql: `select volunteer_ref as ref, volunteer as who, (current_date - issued_on) as days, check_name(kind, jurisdiction) || ' barred, volunteer still ' || volunteer_status as detail
            from v_checks where state = 'BARRED' and volunteer_status in ('active', 'applicant')` },
  { id: 'privacy', title: 'Records of people who left are reviewed once they are no longer needed',
    source: 'Privacy Act 1988 (Cth) APP 11.2; Privacy Act 2020 (NZ) IPP 9',
    sql: `select ref, first_name || ' ' || last_name as who, (current_date - ended_on) as days, status || ' since ' || ended_on || ': review what you still need to keep' as detail
            from volunteers where status in ('former', 'declined') and ended_on <= current_date - 7 * 365` },
];

async function cmdCompliance(db, flags) {
  const results = [];
  for (const r of RULES) {
    const rows = await db.query(`${r.sql} order by 3 desc nulls last`);
    results.push({ rule: r.id, title: r.title, source: r.source, count: rows.length, worst: rows[0] || null, rows });
  }
  out(flags, results, () => {
    console.log(heading('Compliance: the rules in docs/compliance.md, run against the records'));
    console.log(table(results, [
      { key: 'count', label: 'breaches', align: 'right' },
      { key: 'title', label: 'rule', width: 80 },
      { key: 'worst', label: 'worst', width: 40, format: (v) => (v ? `${v.ref} ${v.who}` : 'clean') },
    ]));
    for (const r of results.filter((x) => x.count)) {
      console.log(`\n  ${r.title}\n  source: ${r.source}`);
      for (const row of r.rows.slice(0, 5)) console.log(`    ${row.ref}  ${row.who}  ${row.detail}`);
    }
    console.log('\n  Nothing here is legal advice. Change docs/compliance.md and this check together.');
  });
}

// ---------------------------------------------------------------- import and export

// Better Impact exports profiles from Reports (profile raw data) and hours from
// Reports > Hours Reports > Logged Hours Raw Data, with columns you choose. The
// import matches the usual header names and reports every column it did not use.
const PROFILE_COLS = {
  first: ['First Name', 'Firstname', 'Given Name'],
  last: ['Last Name', 'Lastname', 'Surname', 'Family Name'],
  email: ['Email', 'Email Address', 'Primary Email'],
  phone: ['Mobile Phone', 'Cell Phone', 'Phone', 'Home Phone', 'Mobile'],
  dob: ['Birth Date', 'Date of Birth', 'Birthdate', 'DOB'],
  suburb: ['City', 'Suburb', 'Town'],
  state: ['Province/State', 'State', 'Province', 'Region'],
  status: ['Status', 'Profile Status'],
  start: ['Accepted Date', 'Start Date', 'Date Accepted', 'Volunteer Since'],
  applied: ['Application Date', 'Applied Date', 'Date Created', 'Created Date'],
  emergency: ['Emergency Contact', 'Emergency Contact Name'],
  emergency_phone: ['Emergency Contact Phone', 'Emergency Phone'],
  id: ['Profile ID', 'Volunteer ID', 'User ID', 'ID', 'Database ID'],
  wwcc: ['WWCC Number', 'Working with Children Check', 'WWC Number', 'Blue Card Number'],
  wwcc_expiry: ['WWCC Expiry', 'WWCC Expiry Date', 'Working with Children Check Expiry', 'Blue Card Expiry'],
  police_date: ['Police Check Date', 'Police Check', 'Police Vet Date'],
};
const HOURS_COLS = {
  id: ['Profile ID', 'Volunteer ID', 'User ID', 'ID', 'Database ID'],
  email: ['Email', 'Email Address'],
  first: ['First Name', 'Firstname'],
  last: ['Last Name', 'Lastname', 'Surname'],
  date: ['Date Volunteered', 'Date', 'Volunteer Date', 'Date Worked'],
  hours: ['Hours', 'Hours Logged', 'Logged Hours', 'Total Hours'],
  category: ['Category', 'Activity Category', 'Organization', 'Program'],
  activity: ['Activity', 'Activity Name', 'Assignment'],
  created: ['Date Created', 'Created'],
};

function unusedColumns(rows, map) {
  if (!rows.length) return [];
  const used = new Set(Object.values(map).flat().map((c) => c.toLowerCase()));
  return Object.keys(rows[0]).filter((c) => !used.has(c.toLowerCase()));
}

function profileStatus(v) {
  const s = String(v || '').toLowerCase();
  if (/accept|active/.test(s)) return 'active';
  if (/inactive|on leave|hold/.test(s)) return 'inactive';
  if (/archiv|former|retired|left/.test(s)) return 'former';
  if (/declin|reject/.test(s)) return 'declined';
  return 'applicant';
}

async function cmdImport(db, args, flags) {
  if (args[0] !== 'better-impact') throw new CliError('Usage: import better-impact --volunteers=<profiles.csv> [--hours=<hours.csv>] [--dry-run]');
  if (!flags.volunteers && !flags.hours) throw new CliError('Give --volunteers=<csv> (profiles), --hours=<csv> (Logged Hours Raw Data), or both.');
  const read = (f) => {
    const p = path.resolve(process.cwd(), str(f));
    if (!existsSync(p)) throw new CliError(`No file at ${p}.`);
    return parseCsv(readFileSync(p, 'utf8'));
  };
  const profiles = flags.volunteers ? read(flags.volunteers) : [];
  const hourRows = flags.hours ? read(flags.hours) : [];
  const dry = !!flags['dry-run'];
  const summary = { dry_run: dry, volunteers_new: 0, volunteers_matched: 0, checks: 0, hours_new: 0, hours_skipped: 0, programs_new: [], problems: [], no_emergency: [], no_checks_date: [],
    unused_columns: { volunteers: unusedColumns(profiles, PROFILE_COLS), hours: unusedColumns(hourRows, HOURS_COLS) } };

  await db.exec('BEGIN');
  try {
    const byExt = new Map();
    const byEmail = new Map();
    for (const r of await db.query("select id, external_ref, lower(email) as email, lower(first_name || ' ' || last_name) as name from volunteers")) {
      if (r.external_ref) byExt.set(r.external_ref, r.id);
      if (r.email) byEmail.set(r.email, r.id);
      byEmail.set(`name:${r.name}`, r.id);
    }
    for (const [i, row] of profiles.entries()) {
      const first = pick(row, ...PROFILE_COLS.first).trim();
      const last = pick(row, ...PROFILE_COLS.last).trim();
      if (!first && !last) { summary.problems.push(`profiles row ${i + 2}: no name, skipped`); continue; }
      const ext = pick(row, ...PROFILE_COLS.id).trim() || null;
      const email = pick(row, ...PROFILE_COLS.email).trim() || null;
      const existing = (ext && byExt.get(ext)) || (email && byEmail.get(email.toLowerCase())) || byEmail.get(`name:${`${first} ${last}`.toLowerCase()}`);
      let dob = null; let start = null; let applied = null;
      try { dob = parseDate(pick(row, ...PROFILE_COLS.dob)); start = parseDate(pick(row, ...PROFILE_COLS.start)); applied = parseDate(pick(row, ...PROFILE_COLS.applied)); }
      catch (e) { summary.problems.push(`profiles row ${i + 2} (${first} ${last}): ${e.message}`); }
      const status = profileStatus(pick(row, ...PROFILE_COLS.status));
      const emergency = [pick(row, ...PROFILE_COLS.emergency), pick(row, ...PROFILE_COLS.emergency_phone)].filter(Boolean).join(' ') || null;
      if (status === 'active' && !emergency) summary.no_emergency.push(`${first} ${last}`);
      let id = existing;
      if (existing) summary.volunteers_matched++;
      else {
        const ref = await nextRef(db, 'volunteers', 'V', 1001);
        const [ins] = await db.query(`insert into volunteers (ref, first_name, last_name, email, phone, date_of_birth, suburb, state, status, stage, applied_on, started_on, emergency_contact, external_ref, source)
                                      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'Better Impact') returning id`,
        [ref, first || '(none)', last || '(none)', email, pick(row, ...PROFILE_COLS.phone) || null, dob, pick(row, ...PROFILE_COLS.suburb) || null,
          (pick(row, ...PROFILE_COLS.state) || '').toUpperCase().slice(0, 12) || null, status, status === 'applicant' ? 'applied' : 'done', applied || start, start, emergency, ext]);
        id = ins.id;
        if (ext) byExt.set(ext, id);
        if (email) byEmail.set(email.toLowerCase(), id);
        byEmail.set(`name:${`${first} ${last}`.toLowerCase()}`, id);
        summary.volunteers_new++;
        if (start) await db.query("insert into training (volunteer_id, course, completed_on) values ($1, 'induction', $2) on conflict do nothing", [id, start]);
      }
      // Checks come across unverified, on purpose: verify each with the issuer.
      const wwcc = pick(row, ...PROFILE_COLS.wwcc).trim();
      if (wwcc) {
        let exp = null;
        try { exp = parseDate(pick(row, ...PROFILE_COLS.wwcc_expiry)); } catch { summary.problems.push(`${first} ${last}: Working with Children expiry not a date`); }
        const st = (pick(row, ...PROFILE_COLS.state) || '').toUpperCase().slice(0, 3) || null;
        const r = await db.query('insert into checks (volunteer_id, kind, jurisdiction, number, expires_on, note) values ($1, \'wwcc\', $2, $3, $4, \'imported from Better Impact\') on conflict do nothing returning id', [id, st, wwcc, exp]);
        summary.checks += r.length;
      }
      const police = pick(row, ...PROFILE_COLS.police_date).trim();
      if (police) {
        try {
          const r = await db.query('insert into checks (volunteer_id, kind, jurisdiction, number, issued_on, note) values ($1, \'police\', \'National\', $2, $3, \'imported from Better Impact\') on conflict do nothing returning id', [id, `imported-${police}`, parseDate(police)]);
          summary.checks += r.length;
        } catch (e) { summary.problems.push(`${first} ${last}: police check date "${police}" not read`); }
      } else if (status === 'active' && !wwcc) summary.no_checks_date.push(`${first} ${last}`);
    }

    for (const [i, row] of hourRows.entries()) {
      const ext = pick(row, ...HOURS_COLS.id).trim();
      const email = pick(row, ...HOURS_COLS.email).trim().toLowerCase();
      const name = `${pick(row, ...HOURS_COLS.first)} ${pick(row, ...HOURS_COLS.last)}`.trim().toLowerCase();
      const vid = (ext && byExt.get(ext)) || (email && byEmail.get(email)) || (name && byEmail.get(`name:${name}`));
      if (!vid) { summary.problems.push(`hours row ${i + 2}: no volunteer matches ${ext || email || name || '(blank)'}`); summary.hours_skipped++; continue; }
      let on;
      try { on = parseDate(pick(row, ...HOURS_COLS.date)); } catch { on = null; }
      const minutes = Math.round(Number(String(pick(row, ...HOURS_COLS.hours)).replace(',', '.')) * 60);
      if (!on || !Number.isFinite(minutes) || minutes <= 0 || minutes > 960) { summary.problems.push(`hours row ${i + 2}: date or hours not usable`); summary.hours_skipped++; continue; }
      const programName = pick(row, ...HOURS_COLS.category).trim() || 'Imported from Better Impact';
      let [prog] = await db.query('select id from programs where lower(name) = lower($1)', [programName]);
      if (!prog) {
        const ref = await nextRef(db, 'programs', 'PR', 1);
        [prog] = await db.query('insert into programs (ref, name) values ($1, $2) returning id', [ref.replace(/PR-(\d)$/, 'PR-0$1'), programName]);
        summary.programs_new.push(programName);
      }
      const activity = pick(row, ...HOURS_COLS.activity).trim() || null;
      const key = `bi:${ext || email || name}:${on}:${activity || ''}:${minutes}:${i}`;
      const r = await db.query(`insert into hours (volunteer_id, program_id, worked_on, minutes, activity, source, approved_on, import_key)
                                values ($1, $2, $3, $4, $5, 'import', $3, $6) on conflict (import_key) do nothing returning id`, [vid, prog.id, on, minutes, activity, key]);
      if (r.length) summary.hours_new++; else summary.hours_skipped++;
    }
    await db.exec(dry ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }

  out(flags, summary, () => {
    console.log(heading(`${dry ? 'Dry run (nothing written)' : 'Imported'} from Better Impact`));
    console.log(`  volunteers: ${summary.volunteers_new} new, ${summary.volunteers_matched} matched to records already here`);
    console.log(`  checks: ${summary.checks} brought across, every one NOT VERIFIED until someone looks it up with the issuer`);
    console.log(`  hours: ${summary.hours_new} entries in, ${summary.hours_skipped} skipped`);
    if (summary.programs_new.length) console.log(`  programs made from hours categories: ${summary.programs_new.join(', ')}. Add their roles and what each requires next.`);
    for (const [k, cols] of Object.entries(summary.unused_columns)) if (cols.length) console.log(`  columns not used from ${k}: ${cols.join(', ')} (map them with /customise)`);
    for (const pr of summary.problems.slice(0, 20)) console.log(`  PROBLEM ${pr}`);
    if (summary.no_emergency.length) console.log(`  ${summary.no_emergency.length} active volunteer(s) have no emergency contact: the first audit item.`);
    if (summary.no_checks_date.length) console.log(`  ${summary.no_checks_date.length} active volunteer(s) have no check on record. Fine for roles that need none; run compliance.`);
  });
}

function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => { if (v === null || v === undefined) return ''; const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
}

async function cmdExport(db, flags) {
  const dir = path.resolve(REPO_ROOT, str(flags.out) || path.join('exports', today()));
  mkdirSync(dir, { recursive: true });
  const tables = ['staff', 'programs', 'roles', 'volunteers', 'checks', 'training', 'shifts', 'assignments', 'hours', 'recognitions', 'incidents', 'notes'];
  const counts = {};
  for (const t of tables) {
    const rows = await db.query(`select * from ${t} order by created_at, id`);
    writeFileSync(path.join(dir, `${t}.csv`), toCsv(rows));
    counts[t] = rows.length;
  }
  out(flags, { dir, counts }, () => console.log(`Exported ${tables.length} files to ${path.relative(REPO_ROOT, dir) || dir}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}`));
}

// ---------------------------------------------------------------- dispatch

const HELP = `volunteers-for-claude-code

  stats                                       the program at a glance
  attention                                   everything that wants a decision, worst first
  volunteers [--status= --all --program=]     the list, with hours and check flags
  volunteer <name|ref>                        one volunteer's whole card
  volunteers add --first= --last= [--email= --phone= --dob= --state= --availability= --emergency=]
  volunteers activate <who>                   refused without references, induction, consent under 18
  volunteers pause|farewell <who> [--reason=]
  volunteers consent <who> --guardian=        a parent or guardian's consent for an under 18
  applicants | applicants stage <who> --to=interviewed|references|checks|inducted | applicants decline <who> --reason=
  checks [--all --days=60]                    expired, expiring, unverified, barred
  checks add <who> --kind=wwcc|police|licence [--jurisdiction=NSW --number= --issued= --expires=]
  checks verify <who> [number] --by=          looked up with the issuer: only then does it count
  checks outcome <who> [number] --to=clear|pending|barred|withdrawn
  training [--all --course=] | training add <who> --course= [--on= --expires= | --years=]
  shifts [--days=14 --program=]               the roster ahead
  shifts add --role= --on= --starts= --ends= [--needed=1 --location= --weeks=1]
  shifts cancel <shift> [--reason=]
  roster <shift> <who> [--confirmed]          refused unless cleared for the role that day
  confirm <shift> <who> | unroster <shift> <who>
  attend <shift> [--absent=name,name]         records attendance and the hours
  gaps [--days=14]                            open places and who is cleared to fill them
  hours [--month=2026-09 | --days=30]         hours given, by program and volunteer
  hours log <who> --program=|--role= --hours= [--on= --activity= --approve --by=]
  hours pending | hours approve <who>|--all --by=
  milestones | recognise <who> --milestone= [--how=]
  lapsing [--days=]                           active volunteers who have stopped coming
  incidents [--all] | incidents add --kind= --what= [--volunteer= --program= --notifiable]
  incidents notify <ref> [--on= --reference=] | incidents close <ref> --actions=
  log <who> --body= [--kind=call|email|meeting|note --by=]
  funder [--program= --from= --to=]           approved hours for a funder report
  compliance                                  the rules in docs/compliance.md against the records
  import better-impact --volunteers=<csv> [--hours=<csv>] [--dry-run]
  export [--out=<dir>]                        every record to CSV

  Any read command takes --json.`;

async function main() {
  const { args, flags } = parseArgv(process.argv.slice(2));
  const [cmd, ...rest] = args;
  if (!cmd || cmd === 'help' || flags.help) { console.log(HELP); return; }
  const db = await getDb();
  try {
    switch (cmd) {
      case 'stats': return await cmdStats(db, flags);
      case 'attention': return await cmdAttention(db, flags);
      case 'volunteers': return await cmdVolunteers(db, rest, flags);
      case 'volunteer': return await cmdVolunteer(db, rest, flags);
      case 'applicants': case 'applicant': return await cmdApplicants(db, rest, flags);
      case 'checks': case 'check': return await cmdChecks(db, rest, flags);
      case 'training': return await cmdTraining(db, rest, flags);
      case 'shifts': case 'shift': return await cmdShifts(db, rest, flags);
      case 'roster': return await cmdRoster(db, rest, flags);
      case 'confirm': return await cmdConfirm(db, rest, flags);
      case 'unroster': return await cmdUnroster(db, rest, flags);
      case 'attend': return await cmdAttend(db, rest, flags);
      case 'gaps': return await cmdGaps(db, flags);
      case 'hours': return await cmdHours(db, rest, flags);
      case 'milestones': return await cmdMilestones(db, flags);
      case 'recognise': case 'recognize': return await cmdRecognise(db, rest, flags);
      case 'lapsing': return await cmdLapsing(db, flags);
      case 'incidents': case 'incident': return await cmdIncidents(db, rest, flags);
      case 'log': return await cmdLog(db, rest, flags);
      case 'funder': return await cmdFunder(db, flags);
      case 'compliance': return await cmdCompliance(db, flags);
      case 'import': return await cmdImport(db, rest, flags);
      case 'export': return await cmdExport(db, flags);
      default: throw new CliError(`Unknown command "${cmd}". Run with no arguments for the list.`);
    }
  } finally {
    await db.close();
  }
}

main().catch((e) => {
  console.error(e instanceof CliError ? e.message : e.stack || String(e));
  process.exit(e.code && Number.isInteger(e.code) ? e.code : 1);
});
