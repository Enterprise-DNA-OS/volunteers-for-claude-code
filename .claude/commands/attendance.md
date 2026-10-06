---
description: Record who came to a shift that has happened. Everyone rostered is marked attended and their hours are recorded and approved, except the names given as absent.
---

1. Ask which shift and who did not come, if the operator has not said. Run `node scripts/volunteers.mjs shifts --days=0 --json` or look up the shift ref.
2. Run `node scripts/volunteers.mjs attend <shift> [--absent="Name, Name"] --by="<coordinator>"`. It refuses a shift that has not happened yet.
3. Read back how many attended, the hours recorded, and any no-shows.
4. A second no-show in a month is worth a call, not a rule: offer `/log` for it.
