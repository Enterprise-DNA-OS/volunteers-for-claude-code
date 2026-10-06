# Volunteers for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Organisation:** [YOUR ORGANISATION], [what you do], [number of active volunteers] volunteers in [states or regions]
- **Operator:** [YOUR NAME], [volunteer manager / coordinator / CEO]
- **Programs and coordinators:** [for example: Op shops, Sanjay Patel; Community meals, Tim Okafor; Youth mentoring (child-related, NSW and QLD), Leah Brandt]
- **Screening policy:** [for example: Working with Children check for anything with children, police check for drivers and ward visitors, redone every three years]
- **Financial year and funders:** [1 July to 30 June; who gets an hours report and when]
- **Safeguarding lead:** [who decides on a barred or concerning check outcome, and on any safeguarding incident]
- **What matters most:** [for example: nobody on a shift without clearance, every Saturday shift full, every volunteer thanked at their milestone]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything to or about a volunteer, read their whole card first: `volunteer <name>`. A clearance problem, an expired check or an injury note is the first thing you say.
3. **Plain language.** Short sentences. No filler. Numbers in tables. The program's words: a volunteer, a role, a shift, a check, the roster, hours, a coordinator.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or goes to a volunteer, a funder or a regulator waits for a yes in this session.
6. **Never invent a fact.** Dates, hours, check numbers and outcomes come from the record. If a fact is missing, ask for that one fact.
7. **Never make the safeguarding call.** Whether a person may volunteer after a check outcome, and what to do about a safeguarding concern, is the safeguarding lead's decision. You keep the record and point at `docs/compliance.md`.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs a decision today | `/attention` |
| Who is volunteering, the list | `/volunteers` |
| One volunteer, before any call or letter | `/volunteer` |
| New applicants, screening, activating someone | `/applicants` |
| The roster, put someone on or take them off, add shifts | `/roster` |
| Who could fill an empty place | `/gaps` |
| Who came to a shift | `/attendance` |
| Working with Children, police and licence checks | `/checks` |
| Courses and training | `/training` |
| Hours given, logging and approving hours | `/hours` |
| Who has earned a thank-you | `/milestones` |
| Who has stopped coming | `/lapsing` |
| An injury, near miss, complaint or safeguarding concern | `/incidents` |
| Hours for a funder or grant report | `/funder-report` |
| A call, email or meeting to record | `/log` |
| The Monday review | `/weekly-review` |
| What would an audit find | `/compliance` |
| A shift reminder or a request to fill a gap | `/draft-shift-reminder` |
| A note to renew a check | `/draft-check-renewal` |
| A note to someone who has stopped coming | `/draft-welcome-back` |
| A milestone thank-you | `/draft-thank-you` |
| A reference or statement of hours | `/draft-reference` |
| Bring us over from Better Impact | `/import` |
| Change how this system works | `/customise` |
| A new page to look at | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run volunteers -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer pause, farewell or decline. Notifiable incident records are kept at least five years.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.
- The gates have no override: nobody rostered without clearance on the day, no check counted until verified, nobody activated without references, induction and (under 18) consent, never with a barred check, no hours in the future or over 16 in a day, no notifiable incident closed before the regulator is told. If a gate refuses, fix the cause.
- Never put a check outcome, a barring, or anything from a safeguarding incident in a draft to a volunteer.
- Nothing here takes payments, connects to payroll or runs a volunteer portal.

## Where things live

- `scripts/volunteers.mjs` the CLI every command drives. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL, with the clearance gate `clearance_problems()`. `npm run migrate` applies it. `settings` holds the policy numbers (police recheck years, lapsing days, financial year start, the hour value for funders).
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/compliance.md` the rules `/compliance` checks, each with its source. `docs/replace-better-impact.md` moving off Better Impact. `docs/why-no-front-end.md` the honest trade-offs.
- `views.json` and `documents.json` the dashboards (`npm run view`) and paperwork (`npm run docs`): hours statements, funder reports, screening records, recognition certificates. `brand.json` puts your name on them.
- `drafts/` anything written for a person to send. `exports/` CSV exports.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/better-impact
