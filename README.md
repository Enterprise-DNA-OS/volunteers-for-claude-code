<h1 align="center">Volunteers for Claude Code</h1>

<p align="center">
  <strong>The open-source volunteer management system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Better Impact data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=better-impact">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/better-impact?utm_source=github&utm_medium=readme&utm_campaign=better-impact">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#compliance-checked-against-the-data">Compliance</a> &bull;
  <a href="#ten-questions-better-impact-never-answered">Ten questions</a> &bull;
  <a href="#instead-of-better-impact">Instead of Better Impact</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Volunteers for Claude Code does the job you pay Better Impact for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and run the volunteer program in plain language. It runs the right query, and it answers questions the Better Impact reports never had a page for.

Better Impact does not publish its prices. Its Foundation, Growth and Impact plans are quoted by the number of accepted and inactive volunteer profiles and the features you choose, with the Client and Member modules as add-ons ([betterimpact.com/pricing](https://www.betterimpact.com/pricing)). What a volunteer program needs to hold is ordinary: volunteers from application to farewell, their Working with Children and police checks, their training, programs and the roles inside them, shifts and who is on each, the hours given, recognition and incidents. That is twelve Postgres tables, and the reporting is a handful of SQL views over them.

Want the same thing with a volunteer app for picking shifts and logging hours, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=better-impact).

It is built for charities, hospitals, councils, clubs and event organisers in Australia and New Zealand with 30 to 3,000 volunteers. It carries the work coordinators repeat every week:

```
/attention        everything that wants a decision this morning, worst first
/roster           the next 14 days, filled against needed, and changes to it
/gaps             open places, and who is cleared for that role that day
/checks           Working with Children and police checks expired, expiring, unverified
/applicants       the screening pipeline, stage by stage
/hours            hours given, logged and waiting for approval
/lapsing          active volunteers who have quietly stopped coming
/milestones       hours and years reached that nobody has marked
/incidents        notifiable incidents first, until the regulator is told
/funder-report    approved hours by program and month for a grant report
/compliance       eleven rules from the screening Acts, WHS law and your policy
```

The sharp edges are deliberate, because in volunteering a missed check is a child safety failure:

- **Nobody is rostered without clearance on the day.** Every check the role needs, verified and current through the shift date, every course current, old enough, active, guardian consent under 18. There is no force flag.
- **A Working with Children check belongs to one state.** An NSW check does not clear a Queensland shift.
- **A check counts once someone verifies it with the issuer,** and the record says who and when.
- **A barred outcome takes the person off every upcoming shift,** and never appears in a draft.
- **A notifiable incident does not close until the regulator has been told.**

**Nothing here sends, takes a payment or runs a volunteer portal.** Reminders, renewal notes, thank-yous and references draft to files in your brand; a person sends them. Nothing here is legal advice.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/volunteers-for-claude-code.git
cd volunteers-for-claude-code
npm install
npm run demo
```

`npm run demo` creates the database, loads Northside Community Care (a fictional Sydney charity with op shops, community meals, youth mentoring, hospital visiting and events, and a Gold Coast mentoring branch: 24 volunteers, seven months of shifts and hours, and a week going quietly wrong: Josh rostered to mentor on Thursday with his NSW Working with Children check expired ten days ago, Priya rostered in the kitchen with lapsed food safety training, Peter's fractured wrist not yet reported to SafeWork, Kevin's police check running out with a drive tomorrow he has not confirmed, Saturday's sorting room one of four, a Queensland blue card nobody has verified, a barred applicant still open, a 16 year old with no guardian consent, Sienna waiting three weeks for her references, Tom's hours waiting twelve days for approval, Ian and Fiona quietly gone, and Margaret's ten years and Helen's 500 hours unmarked), then prints the attention list and who could fill the gaps.

Then open the folder in Claude Code and type:

```
/attention
```

Try `/gaps`, `/checks`, `/volunteer Josh`, `/funder-report`, `/weekly-review`. When you are ready for real data, delete `.data/` and start with `/import`.

Fill in the "Who this is for" block in [CLAUDE.md](CLAUDE.md), especially your programs, the states you work in and your screening policy, and put your name and colours in [brand.json](brand.json) so every statement and certificate carries them.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-volunteer fee. Every coordinator clones the repo, points at the same `DATABASE_URL`, and works in their own Claude Code.

## The commands

| Command | What it does |
|---|---|
| `/attention` | Everything that wants a decision, worst first: someone rostered without clearance outranks all. |
| `/volunteers` | The list: hours in 12 months and all time, last and next shift, check flags. |
| `/volunteer` | One volunteer's whole card: checks, training, shifts, hours by program, milestones, notes. |
| `/applicants` | The screening pipeline by stage, days waiting; move on, activate or decline. |
| `/roster` | The next 14 days; roster, confirm, take off, add and cancel shifts. Refuses anyone not cleared. |
| `/gaps` | Open places and the volunteers cleared and free to fill each, most experienced first. |
| `/attendance` | Who came to a shift; their hours recorded and approved. |
| `/checks` | Working with Children, police and licence checks: barred, expired, unverified, expiring. Record and verify. |
| `/training` | Courses expired or expiring, and anyone working a role without its course. |
| `/hours` | Hours by program and volunteer; log hours, approve self-logged hours. |
| `/milestones` | 50 to 2,500 hours and 1 to 25 years reached and not yet marked. |
| `/lapsing` | Active volunteers with nothing rostered and no hours for 60 days, with their last note. |
| `/incidents` | Injuries, near misses, complaints, safeguarding; notifiable first until reported. |
| `/funder-report` | Approved hours by program and month, volunteers counted once, for a grant report. |
| `/log` | A call, email, meeting or note against a volunteer. |
| `/weekly-review` | The Monday review, written from three commands. |
| `/compliance` | Eleven rules, each with its source, run against your records. |
| `/draft-shift-reminder` | A shift reminder or a request to fill a gap. Drafts only. |
| `/draft-check-renewal` | A note asking a volunteer to renew an expiring check. Drafts only. |
| `/draft-welcome-back` | A note to a volunteer who has stopped coming. Drafts only. |
| `/draft-thank-you` | A thank-you for a milestone. Drafts only. |
| `/draft-reference` | A reference or statement of hours from the record. Drafts only. |
| `/import` | Bring the program across from Better Impact exports. The import is the first audit. |
| `/customise` | Add a field, a role, a rule, in plain language. |
| `/new-view` | Add a read-only HTML dashboard from a description. |

Everything the commands do, the CLI does: `npm run volunteers -- help`. Any read command takes `--json`.

### Documents and views, in your brand

```bash
npm run docs    # hours statements, funder reports, screening records, recognition certificates
npm run view    # the week (decisions, roster, checks) and hours and people, as read-only HTML
```

Both read [brand.json](brand.json). Documents land in `docs-out/`, views in `views/`. Print either to PDF from the browser. `/new-view` adds a view, `documents.json` adds a document.

## Compliance, checked against the data

`/compliance` runs the rules in [docs/compliance.md](docs/compliance.md) against your records and reports what is breached, each rule citing its source:

1. Child-related work needs a current Working with Children check from the state the work is in (Child Protection (Working with Children) Act 2012 (NSW); Working with Children (Risk Management and Screening) Act 2000 (Qld); Worker Screening Act 2020 (Vic)).
2. A Working with Children check is verified with the issuer, and the verification recorded.
3. Nobody works a role without the checks and training it requires on the day (Work Health and Safety Act 2011 s19, volunteers are workers under s7; Health and Safety at Work Act 2015 (NZ) s36).
4. Police checks are redone on your cycle, three years by default.
5. A barring outcome ends the application and every rostered shift.
6. A notifiable incident is reported to the regulator immediately (WHS Act 2011 s35 to s38; HSWA 2015 (NZ) s23 to s25 and s56).
7. Notifiable incident records are kept at least five years (WHS Act 2011 s38(7); HSWA 2015 (NZ) s57).
8. Every active volunteer has an induction on record (National Standards for Volunteer Involvement, Standard 5).
9. Every active volunteer has an emergency contact.
10. Volunteers under 18 have a parent or guardian's consent on file.
11. Records of people who left are reviewed once no longer needed (Privacy Act 1988 (Cth) APP 11.2; Privacy Act 2020 (NZ) IPP 9).

Nothing here is legal advice: it is the rule book you point the system at, and you change it with whoever advises you on screening and safety.

## Ten questions Better Impact never answered

Every one of these is answered by the demo data today. Yours will be different, and that is the point.

1. Who is rostered in the next fortnight without the checks or training their role needs on that day?
2. Whose Working with Children check runs out before their next rostered shift?
3. Who is cleared for Saturday's sorting room, free at that time, and has done the role most often?
4. Which checks have been recorded but never verified with the issuer, and by whom should they be?
5. Which active volunteers have had nothing rostered and no hours for 60 days, and what did the last note say?
6. Who has reached 500 hours or ten years and not been thanked?
7. How many approved hours did each program give each month this financial year, with each volunteer counted once?
8. Which applicants have waited more than two weeks at one screening stage?
9. Which notifiable incidents have not been reported, and which open incidents are older than two weeks?
10. Which volunteers under 18 are active without a parent or guardian's consent on file?

## Your first hour: ten things to ask for

Open the folder in Claude Code and say these in your own words. Each one changes the system to fit your program.

1. "Import our profiles and logged hours, then show me what the old system never told us."
2. "Our programs are Op shops, Meals and Mentoring. Mentoring is child-related in NSW and Victoria."
3. "Drivers need a police check, a licence and the induction. Add the role."
4. "We redo police checks every two years, not three."
5. "Our financial year runs July to June, and the council values an hour at the rate in their grant letter."
6. "Put our logo and colours on the hours statement and the thank-you certificate."
7. "Add a T-shirt size and a dietary needs field to every volunteer."
8. "Every Monday, draft a renewal note to anyone whose check runs out in the next 60 days."
9. "Flag anyone who has missed two shifts in a month."
10. "Add the Gold Coast branch with its own coordinator and Queensland blue cards."

`/customise` writes the migration, applies it, updates every command that touches the change, and runs the tests.

## Instead of Better Impact

Export two reports from Better Impact (volunteer profiles, and Logged Hours Raw Data), save them as CSV, and run one command. The import matches columns by name, names every column it did not use, and brings every check across as not verified, so someone looks each one up. Step by step, with what maps and what does not carry over: [docs/replace-better-impact.md](docs/replace-better-impact.md).

```bash
npm run volunteers -- import better-impact --volunteers=profiles.csv --hours=hours.csv --dry-run
npm run volunteers -- import better-impact --volunteers=profiles.csv --hours=hours.csv
```

The import is the first audit: every check to verify and every active volunteer without an emergency contact is named the moment it finishes.

## Architecture

```
volunteers-for-claude-code/
  CLAUDE.md                     how the operator wants this run (routing table + house rules)
  AGENTS.md                     the same, for Codex / OpenCode / Cursor / Gemini CLI
  brand.json                    your name and colours on every document and view
  views.json                    the HTML dashboards npm run view renders
  documents.json                the paperwork npm run docs renders
  .claude/commands/             the slash commands
  scripts/volunteers.mjs        the CLI the commands drive
  scripts/view.mjs              read-only HTML dashboards from the SQL views
  scripts/docs.mjs              the documents, one HTML file per record
  scripts/lib/db.mjs            one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/          plain SQL schema, tables, views and the clearance gate
  supabase/seed.sql             demo data
  docs/compliance.md            the rules /compliance checks, each with its source
  docs/replace-better-impact.md moving off Better Impact
  docs/why-no-front-end.md      the honest trade-offs
  drafts/                       anything written for a person to send
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end, nothing that sends, and the clearance, verification, consent and notification gates stay.

## Want it installed and run for you?

Enterprise DNA installs Volunteers for Claude Code for your organisation, brings your Better Impact records across, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=better-impact)
- Read more: [enterprisedna.co/omni/instead-of/better-impact](https://enterprisedna.co/omni/instead-of/better-impact?utm_source=github&utm_medium=readme&utm_campaign=better-impact)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
