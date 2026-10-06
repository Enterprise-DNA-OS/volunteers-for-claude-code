---
description: Active volunteers who have quietly stopped coming: nothing rostered and no shift or hours for longer than the setting (60 days by default), with their last note.
---

1. Run `node scripts/volunteers.mjs lapsing --json` (`--days=45` to look sooner).
2. Show each with days since last seen, all-time hours and the last note. A long-serving volunteer goes first: they are the ones worth a phone call.
3. If the last note explains it (an injury, a family matter), say so and suggest a date to check in, not a reminder.
4. Offer `/draft-welcome-back`, or `volunteers pause "<who>" --reason=` if they have said they need a break, or `volunteers farewell` if they have left.
