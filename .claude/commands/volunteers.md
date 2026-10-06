---
description: The volunteer list: who is active, their hours in the last 12 months and all time, last and next shift, and any check that needs action. Filter by status or program.
---

1. Run `node scripts/volunteers.mjs volunteers --json` (add `--status=inactive`, `--status=applicant`, `--all`, or `--program="<name>"`).
2. Show a table: ref, name, hours in 12 months, last shift, next shift, check flags. Sort by what the operator asked for; default is by ref.
3. Call out anyone with a roster problem or a check flag first.
4. For one person's whole story, use `/volunteer`.
