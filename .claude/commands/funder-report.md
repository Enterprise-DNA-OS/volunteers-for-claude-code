---
description: The volunteer hours a funder or grant report asks for: approved hours by program and month, volunteers counted once, new volunteers, for the financial year to date or any dates. Renders it as a document too.
---

1. Run `node scripts/volunteers.mjs funder --json` (`--program="<name>" --from=<date> --to=<date>`). The default is the financial year to date from `settings.fy_start_month`.
2. Present totals per program, then by month. Approved hours only; say if any are still waiting (`hours pending`).
3. A dollar value appears only if the organisation has set its own hourly figure (`settings.hour_value_cents`). Never invent one; if the funder names a rate, set it with `/customise`.
4. For the printable version: `npm run docs -- funder-report`, then open the file in `docs-out/funder-report/` and print to PDF.
