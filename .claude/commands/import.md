---
description: Bring the volunteer program across from Better Impact (or any system that exports CSV): volunteer profiles, Working with Children numbers and expiry dates, and logged hours. The import is the first audit.
---

1. Read `docs/replace-better-impact.md` first: which two reports to export, what maps by column name, what stays behind.
2. Always dry-run first: `node scripts/volunteers.mjs import better-impact --volunteers=<profiles.csv> [--hours=<hours.csv>] --dry-run --json`. Walk the operator through the counts, every problem row, and every column the import did not use.
3. Unused columns that matter (a custom field, a second emergency contact, a qualification) are a `/customise` job before the real import, not after.
4. Then for real, without `--dry-run`. Re-running is safe: volunteers match on profile id, then email, then name; hours rows never load twice.
5. After it lands:
   - every imported check is NOT VERIFIED on purpose: verify each with the issuer (`checks verify`)
   - add the roles each program runs and what each requires (`/customise`), so rostering can check clearances
   - add training on record (`training add`) and emergency contacts the export lacked
6. Then run `/attention` and show the operator what the old system never told them.
