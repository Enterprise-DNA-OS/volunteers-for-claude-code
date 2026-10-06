---
description: Hours given: totals by program and the volunteers who gave the most, for the last 30 days or a month. Logs hours and approves the ones volunteers logged themselves.
---

1. Run `node scripts/volunteers.mjs hours --json` (`--month=2026-09` or `--days=90`).
2. Show hours by program, then the top volunteers. Approved hours only; say how many are waiting.
3. To log hours someone gave outside a shift: `hours log "<who>" --program="<program>" | --role="<role>" --hours=2.5 [--on=<date> --activity=]`. Never a future date, never over 16 hours in a day. Add `--approve --by=` when a coordinator is logging it.
4. Pending: `hours pending`. Approve: `hours approve "<who>" --by=` or `hours approve --all --by=`. Read what you are approving back to the operator first.
