---
description: Incidents: injuries, near misses, complaints, safeguarding and property, with notifiable incidents first until the regulator has been told. Records, notifies and closes.
---

1. Run `node scripts/volunteers.mjs incidents --json` (`--all` for closed ones too).
2. Any notifiable incident not yet reported is the first line, in plain words: the regulator must be told immediately, and the site left as it is until an inspector says otherwise (docs/compliance.md has the rule and the source).
3. Record one: `incidents add --kind=injury|"near miss"|complaint|safeguarding|property --what="..." [--volunteer= --program= --on= --notifiable]`. A death, a serious injury or illness (admitted to hospital, for example) or a dangerous incident is notifiable.
4. Once told: `incidents notify <ref> [--on= --reference=<regulator reference>]`. Close: `incidents close <ref> --actions="what was fixed"`. A notifiable incident will not close until it has been reported.
5. A safeguarding incident involving a child goes to the safeguarding lead the same day. Never draft anything about it to the people involved.
