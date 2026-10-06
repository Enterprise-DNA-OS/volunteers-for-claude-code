---
description: Training expired or expiring, and anyone working a role without the course it requires. Records a completed course.
---

1. Run `node scripts/volunteers.mjs training --json` (`--course=food-safety`, `--all`).
2. Show expired and expiring first, then the list of people working a role without its course on record.
3. To record a course: `training add "<who>" --course=<course> [--on=<date>] [--expires=<date> | --years=3]`. Courses are plain words: induction, child-safe, manual-handling, food-safety, infection-control, first-aid.
4. Say which upcoming shifts each fix unblocks (run `/roster`).
