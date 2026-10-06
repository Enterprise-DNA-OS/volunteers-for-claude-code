---
description: The roster for the next 14 days and the changes to it: put someone on a shift, confirm, take them off, add or cancel shifts. Rostering refuses anyone not cleared for the role that day.
---

1. Run `node scripts/volunteers.mjs shifts --json` (`--days=28`, `--program=`). Show each shift with filled against needed, who is on it (? means not confirmed), and any not cleared.
2. To put someone on: `node scripts/volunteers.mjs roster <shift> "<who>"` (add `--confirmed` if they already said yes). It refuses anyone without the checks, training, age, status or consent the role needs on that date, and anyone already working at that time. Read the refusal back and say what would clear it.
3. Confirm: `confirm <shift> "<who>"`. Take off: `unroster <shift> "<who>"`, then run `/gaps`.
4. New shifts: `shifts add --role="<role>" --on=<date> --starts=09:00 --ends=12:00 --needed=2 [--weeks=6 --location=]`. Cancel: `shifts cancel <shift> --reason=` and tell the people it names.
5. Reminders to volunteers are `/draft-shift-reminder`. Nothing is sent from here.
