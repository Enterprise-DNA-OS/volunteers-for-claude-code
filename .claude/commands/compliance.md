---
description: Check the volunteer records against the rules in docs/compliance.md (Working with Children checks by state, verified checks, clearance for every rostered role, police rechecks, notifiable incidents, under 18 consent, induction, emergency contacts, barred outcomes, privacy) and report what is breached, with the rule cited.
---

1. Run `node scripts/volunteers.mjs compliance --json`. Each rule in `docs/compliance.md` has a name, the source it comes from, what a breach looks like in the data, and the query that finds it.
2. Report as a table: rule, count, the worst example, the source. Breached first, then clean.
3. For anything breached, the fix the operator can approve: take someone off a shift (`unroster`), verify a check, record training, notify the regulator, record consent. Drafts go to `drafts/`, never sent.
4. If a rule in `docs/compliance.md` is out of date, say so and stop. Do not guess at law. The operator confirms the rule, then you update the doc and the check in `scripts/volunteers.mjs` (`RULES`) together.

Nothing here is legal advice. The doc records the rules the operator has told the system to enforce, with sources, and this command checks the data against them.
