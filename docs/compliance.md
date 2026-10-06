# The rules `/compliance` checks

Each rule below is checked against the records by `node scripts/volunteers.mjs compliance`. The rule, its source, what a breach looks like in the data, and where the check lives (`RULES` in `scripts/volunteers.mjs`). The roster gate (`clearance_problems()` in the schema) enforces the first three before anyone is put on a shift.

Nothing here is legal advice. It is the rule book you point the system at. When a rule changes, change this page and the check together, with whoever advises you on screening and safety.

## Screening

### 1. Child-related work needs a current Working with Children check from the state the work is in

- **Source:** Child Protection (Working with Children) Act 2012 (NSW); Working with Children (Risk Management and Screening) Act 2000 (Qld), the blue card; Worker Screening Act 2020 (Vic). Volunteers in child-related work need a check in each of these states, and a check from one state does not clear work in another.
- **In the data:** a program marked `child_related`, or a role whose `required_checks` include `wwcc`, needs a `wwcc` check with `jurisdiction` equal to the role's `state`, outcome clear, verified, and good through the shift date.
- **Breach:** anyone rostered to such a shift without one. The roster command refuses it up front; this catches checks that ran out after the person was rostered.

### 2. A Working with Children check is verified with the issuer and the verification recorded

- **Source:** in NSW the organisation verifies the number online with the Office of the Children's Guardian; Queensland links a blue card to the organisation through Blue Card Services; Victoria's Working with Children Check service is the same idea. Your screening policy.
- **In the data:** `checks.verified_on` and `checks.verified_by`. An unverified check does not count for rostering.
- **Breach:** an active volunteer or applicant with a `wwcc` check that nobody has verified.

### 3. Nobody works a role without the checks and training it requires on the day

- **Source:** Work Health and Safety Act 2011 s19 (the primary duty of care) and s7 (a volunteer is a worker); Health and Safety at Work Act 2015 (NZ) s36, with volunteer workers defined in s19; your role descriptions.
- **In the data:** `roles.required_checks`, `roles.required_training` and `roles.min_age`, checked by `clearance_problems()` for every rostered or confirmed place.
- **Breach:** anyone rostered whose check, course, age, status or consent would not pass the gate today.

### 4. Police checks are renewed on your cycle

- **Source:** your screening policy. A national police check has no expiry printed on it, so the organisation sets how often it is redone: `settings.police_recheck_years`, three by default. In New Zealand the Children's Act 2014 requires a safety recheck of paid children's workers every three years; it does not apply to most volunteers, but many organisations use the same cycle.
- **Breach:** an active volunteer whose only police check is older than the cycle.

### 5. A barring outcome ends the application and every rostered shift

- **Source:** the three state Acts in rule 1; your safeguarding policy.
- **In the data:** `checks.outcome = 'barred'`. Recording it takes the person off every upcoming shift, and activation and rostering refuse them.
- **Breach:** a barred person still active or with an open application. Never put the outcome in a draft to the person; that conversation is the safeguarding lead's.

## Safety

### 6. A notifiable incident is reported to the regulator immediately

- **Source:** Work Health and Safety Act 2011 s35 to s38 (a death, a serious injury or illness, or a dangerous incident; a serious injury includes one needing immediate treatment as an in-patient in hospital); Health and Safety at Work Act 2015 (NZ) s23 to s25 and s56. The regulator is SafeWork or WorkSafe in your state, WorkSafe New Zealand in New Zealand. The site is preserved until an inspector says otherwise.
- **In the data:** `incidents.notifiable` and `incidents.notified_on`. A notifiable incident will not close until `notified_on` is set.
- **Breach:** any notifiable incident with no `notified_on`.

### 7. Notifiable incident records are kept for at least five years

- **Source:** Work Health and Safety Act 2011 s38(7); Health and Safety at Work Act 2015 (NZ) s57.
- **In the data:** nothing is deleted from `incidents`. The check flags a closed notifiable incident with no record of the actions taken.

### 8. Every active volunteer has an induction on record

- **Source:** National Standards for Volunteer Involvement (Volunteering Australia, 2015), Standard 5, support and development; Work Health and Safety Act 2011 s19(3)(f), information, training and instruction.
- **Breach:** an active volunteer with no `induction` in `training`.

### 9. Every active volunteer has an emergency contact

- **Source:** your volunteer policy; Work Health and Safety Regulations 2011 r43, emergency plans.
- **Breach:** an active volunteer with no `emergency_contact`.

## People

### 10. Volunteers under 18 have a parent or guardian's consent on file

- **Source:** your volunteer policy; National Standards for Volunteer Involvement (Volunteering Australia, 2015), Standard 4, recruitment and selection.
- **In the data:** `volunteers.guardian_name` and `guardian_consent_on`. Activation and rostering refuse an under 18 without it.
- **Breach:** an active volunteer or applicant under 18 with no consent recorded.

### 11. Records of people who left are reviewed once no longer needed

- **Source:** Privacy Act 1988 (Cth), Australian Privacy Principle 11.2; Privacy Act 2020 (NZ), information privacy principle 9.
- **In the data:** `volunteers.ended_on` for former volunteers and declined applicants.
- **Breach:** a record ended more than seven years ago. Decide with your policy what to keep (hours statements are often asked for years later; screening records may have their own retention rule) and what to remove. Nothing here deletes automatically.

## Changing a rule

Say it in plain words to `/customise`: "our police checks are redone every two years", "add Victoria's Working with Children check for the Geelong program", "first aid is required for event crew". It updates `settings`, the role, this page and the check together, and runs the tests.
