# Moving off Better Impact

Better Impact keeps your volunteers' profiles, their qualifications and checks, the schedule and the hours they logged. Two reports bring the parts that matter across. Plan an afternoon: the export takes minutes, and the rest is checking what came over.

## 1. Export two files

Both are standard Better Impact reports. Export each as CSV (or as XLSX, then save as CSV).

1. **Volunteer profiles.** From Reports, run a raw data report on profiles and report on everyone, including inactive and archived profiles if you want their history. Include at least: profile ID, first name, last name, email, mobile phone, birth date, city, province/state, status, the date they were accepted, emergency contact name and phone, and any qualification fields you use for Working with Children numbers and expiry dates and police check dates.
2. **Hours.** Reports, then Logged Hours Raw Data under Hours Reports. Click Report on Everyone, set the Date Volunteered range to cover the history you want, and under Columns to Include keep the profile ID, first and last name, date volunteered, category, activity and hours. Save the report so you can run it again on cut-over day.

Better Impact's own help pages describe both reports; the column names can differ by account, which is why the import matches by name and tells you what it did not use.

## 2. Dry run

```bash
npm run volunteers -- import better-impact --volunteers=profiles.csv --hours=hours.csv --dry-run
```

Nothing is written. You get: how many volunteers are new and how many matched people already here, how many checks and hours rows came across, every row it could not read and why, and every column it did not use.

Columns that matter and were not used (a custom field, a second contact, a skills list) are a `/customise` job before the real import: ask for the column and where it should go.

## 3. Import

Run the same command without `--dry-run`. Running it again is safe: volunteers match on profile ID, then email, then name, and an hours row never loads twice.

## What maps

| Better Impact | Here |
|---|---|
| Profile ID | `volunteers.external_ref` |
| First name, last name, email, mobile, birth date, city, province/state | the same fields on `volunteers` |
| Status: Accepted / Inactive / Archived / Applicant | `active` / `inactive` / `former` / `applicant` |
| Accepted date | `started_on`, plus an induction on that date |
| Emergency contact name and phone | `emergency_contact` |
| Working with Children number and expiry | a `wwcc` check for the profile's state, NOT VERIFIED |
| Police check date | a `police` check issued that day, NOT VERIFIED |
| Logged hours: date, hours, category, activity | `hours`, approved, with the category as the program |

## What does not carry over

- **Verification.** Every check arrives unverified on purpose. Look each one up with the issuer and record it (`checks verify`), and the roster will start trusting it.
- **Roles and their requirements.** Better Impact's opportunities and their qualification rules are set up in its screens. Here each program's roles and what they require are a short `/customise` job: "Youth mentoring has a Homework mentor role in NSW needing a Working with Children check, a police check and the child safe course."
- **The future schedule.** Add the coming shifts with `shifts add` (it repeats weekly with `--weeks=`), then roster people.
- **Files and photos.** Uploaded documents stay in Better Impact; download any you must keep before the account closes.
- **The volunteer portal and app.** Volunteers who log their own hours or pick their own shifts in Better Impact's app have no screen here. Enterprise DNA builds one on this database when you need it.

## After the import

Run `/attention`, then `/compliance`. The first list is usually: checks to verify, emergency contacts missing, roles without requirements, and the volunteers who quietly stopped coming months ago.
