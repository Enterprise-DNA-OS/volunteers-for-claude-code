---
description: The screening pipeline: everyone who has applied, by stage (applied, interviewed, references, checks, inducted), how long each has waited, and their checks. Moves an applicant on or closes the application.
---

1. Run `node scripts/volunteers.mjs applicants --json`.
2. Show them by stage with days waiting. Anyone waiting 14 days or more at a stage is the coordinator's next call.
3. To move someone on: `node scripts/volunteers.mjs applicants stage "<who>" --to=interviewed|references|checks|inducted`. Reaching `inducted` records the induction.
4. To make them active: `node scripts/volunteers.mjs volunteers activate "<who>"`. It refuses without references, induction, an emergency contact, and guardian consent under 18, and never with a barred check. Fix the cause; there is no override.
5. To close an application: `applicants decline "<who>" --reason=`. The reason stays on the record and never goes in a draft to the applicant.
