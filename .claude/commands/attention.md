---
description: Everything that wants a decision this morning, worst first. Anyone rostered without clearance, a barred check or an unreported notifiable incident outranks everything, then expired and unverified checks, short shifts, open incidents, and the people side: applicants waiting, hours to approve, lapsing volunteers, milestones.
---

1. Run `node scripts/volunteers.mjs attention --json`.
2. Present it worst first, grouped by reason, in plain words. Anything rank 1 is today's first job: say so in the first line. A notifiable incident not yet reported goes to the regulator today (SafeWork in the state, or WorkSafe in New Zealand); someone rostered without clearance comes off the shift or gets cleared before it starts.
3. For each group, give the one action that clears it: `unroster <shift> <who>` then `gaps`, `checks verify <who> <number> --by=`, `checks add`, `training add <who> --course=`, `incidents notify <ref>`, `volunteers consent <who> --guardian=`, `applicants stage <who> --to=`, `hours approve <who> --by=`, `recognise <who> --milestone=`, `/draft-check-renewal`, `/draft-welcome-back`, `/draft-thank-you`.
4. Never say why a check came back barred, in any draft. That conversation is the safeguarding lead's.
5. If the list is empty, say so in one line and stop.
