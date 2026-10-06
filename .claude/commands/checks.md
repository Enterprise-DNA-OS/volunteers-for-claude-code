---
description: Screening checks to act on: Working with Children checks (by state), police checks and licences that are expired, expiring inside 60 days, not yet verified, pending or barred. Records and verifies checks.
---

1. Run `node scripts/volunteers.mjs checks --json` (`--days=90`, or `--all` for every check).
2. Show them worst first: BARRED, EXPIRED, NOT VERIFIED, PENDING, EXPIRING. For each, the volunteer, the check, the number, the date it stops counting, and whether they are rostered before then.
3. To record a check: `checks add "<who>" --kind=wwcc --jurisdiction=NSW --number= [--issued= --expires=]`. A police check without a printed expiry runs out after `settings.police_recheck_years`.
4. To verify it: look it up with the issuer (the Office of the Children's Guardian online check in NSW, Blue Card Services in Queensland, Working with Children Check Victoria), then `checks verify "<who>" <number> --by="<you>"`. Until then it does not count for rostering.
5. To record an outcome: `checks outcome "<who>" <number> --to=barred|pending|clear|withdrawn`. Barred takes them off every upcoming shift. Never put a barring outcome in a draft.
6. For anyone expiring, offer `/draft-check-renewal`.
