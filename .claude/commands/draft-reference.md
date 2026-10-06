---
description: Draft a reference letter or a statement of hours for a volunteer: for a job, a university, a visa or a government program. Drafts only, from the record.
---

1. Run `node scripts/volunteers.mjs volunteer "<who>" --json`.
2. Ask what it is for if the operator has not said. Only state what the record holds: dates, programs, roles, approved hours, training completed. Never a judgement the record does not support; leave a marked line for the coordinator to add their own words.
3. Write `drafts/reference-<ref>-<YYYY-MM-DD>.md`. For a plain hours statement, `npm run docs -- hours-statement` renders it in the brand.
4. A person signs and sends.
