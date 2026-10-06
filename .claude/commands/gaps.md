---
description: Open places in the coming shifts, and for each one the volunteers who are cleared for that role on that day and free at that time, most experienced in the role first.
---

1. Run `node scripts/volunteers.mjs gaps --json` (`--days=21` to look further).
2. For each short shift: the role, the day and time, how many are still needed, then up to five people who could fill it with how often they have done that role in six months, their availability and phone.
3. When nobody is cleared, say what is missing for the nearest candidates (run `/volunteer` on one): usually a course or a check. That is the fix, not a different person.
4. When the operator picks someone, roster them with `roster <shift> "<who>"`. Offer `/draft-shift-reminder` for the ask.
