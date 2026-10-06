---
description: Draft a thank-you for a milestone (hours or years of service), and the line for the newsletter if they agree. Drafts only.
---

1. Run `node scripts/volunteers.mjs volunteer "<who>" --json`.
2. Write `drafts/thank-you-<ref>-<YYYY-MM-DD>.md`: the milestone in their own numbers (hours, years, the programs and roles), one specific thing from the record (the role they always fill, the shift they never miss), signed by the coordinator.
3. Add a one-line newsletter mention, marked as needing their consent first.
4. Once it goes, record it: `recognise "<who>" --milestone= --how=`. `npm run docs -- recognition-certificate` renders the certificate.
