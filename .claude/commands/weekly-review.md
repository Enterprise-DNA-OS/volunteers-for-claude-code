---
description: The Monday review of the volunteer program, written from three commands: what needs a decision, the roster gaps for the fortnight, and the hours and people.
---

1. Run, `--json` each: `node scripts/volunteers.mjs attention`, `node scripts/volunteers.mjs gaps`, `node scripts/volunteers.mjs hours`.
2. Write four short sections, prose plus small tables, nothing invented:
   - **Today.** Rank 1 and 2 items from the attention list, one action each.
   - **The roster.** Shifts short in the next fortnight and who is cleared to fill each.
   - **Screening.** Checks expiring, unverified, training lapsed, applicants waiting.
   - **People.** Hours in the last 30 days by program, who has stopped coming, milestones to mark.
3. End with at most five actions for the week, each one a single command or phone call.
4. On paper: `npm run view` renders the week and hours pages in the organisation's brand.
