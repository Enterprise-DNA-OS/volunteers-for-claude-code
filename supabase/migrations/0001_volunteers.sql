-- Volunteers for Claude Code: the schema.
--
-- A volunteer program's record the way Better Impact holds it, plus the dates
-- the screening rules run on: the coordinators, the programs and the roles
-- inside them with what each role requires (a check, training, a minimum age),
-- the volunteers from application to farewell, their screening checks with
-- the expiry and who verified them, their training, the shifts and who is
-- rostered on each, the hours they give, the recognition they have earned,
-- incidents, and notes.
--
-- Plain Postgres. Runs on any Postgres 13+ and on PGlite. No extensions.

create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- the organisation

-- One row. The rules your policy sets, kept in the data so every view reads them.
create table if not exists settings (
  id                    int primary key default 1 check (id = 1),
  org_name              text not null default 'Your organisation',
  fy_start_month        int not null default 7 check (fy_start_month between 1 and 12),
  police_recheck_years  int not null default 3,      -- your policy for a police check with no expiry printed on it
  quiet_after_days      int not null default 60,     -- an active volunteer with no shift or hours this long is lapsing
  hour_value_cents      int,                         -- your figure for an hour of volunteer time in a funder report; null = not shown
  updated_at            timestamptz not null default now()
);
insert into settings (id) values (1) on conflict (id) do nothing;

create table if not exists staff (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  role        text,                 -- 'Volunteer coordinator', 'Program lead'
  email       text,
  status      text not null default 'active' check (status in ('active', 'former')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists programs (
  id               uuid primary key default gen_random_uuid(),
  ref              text not null unique,          -- PR-01
  name             text not null unique,          -- 'Youth mentoring', 'Op shops'
  coordinator_id   uuid references staff(id),
  child_related    boolean not null default false,   -- work with children: a Working with Children check is required
  funder           text,                          -- who the hours are reported to
  status           text not null default 'active' check (status in ('active', 'closed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists roles (
  id                  uuid primary key default gen_random_uuid(),
  ref                 text not null unique,       -- R-101
  program_id          uuid not null references programs(id),
  name                text not null,              -- 'Shop assistant', 'Driver'
  state               text,                       -- where the work happens: a Working with Children check must be from this state
  min_age             int not null default 16,
  required_checks     text[] not null default '{}',     -- kinds from checks.kind: 'wwcc', 'police', 'licence'
  required_training   text[] not null default '{}',     -- courses from training.course: 'induction', 'child-safe'
  status              text not null default 'active' check (status in ('active', 'closed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (program_id, name)
);

-- ---------------------------------------------------------------- volunteers

create table if not exists volunteers (
  id                    uuid primary key default gen_random_uuid(),
  ref                   text not null unique,      -- V-1001
  first_name            text not null,
  last_name             text not null,
  email                 text,
  phone                 text,
  date_of_birth         date,
  suburb                text,
  state                 text,                      -- NSW, QLD, VIC, AKL
  status                text not null default 'applicant'
                        check (status in ('applicant', 'active', 'inactive', 'former', 'declined')),
  stage                 text not null default 'applied'   -- the screening steps, for applicants
                        check (stage in ('applied', 'interviewed', 'references', 'checks', 'inducted', 'done')),
  applied_on            date,
  interviewed_on        date,
  references_ok_on      date,
  started_on            date,
  ended_on              date,
  end_reason            text,
  guardian_name         text,                      -- under 18: who consented
  guardian_consent_on   date,
  emergency_contact     text,
  availability          text,                      -- 'Weekday mornings', 'Saturdays'
  interests             text,
  source                text,                      -- 'Website', 'Seek Volunteer', 'Friend'
  external_ref          text,                      -- the Better Impact profile id
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Screening checks: Working with Children (by state), police checks, licences.
-- A check counts only once someone has verified it against the issuer.
create table if not exists checks (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references volunteers(id),
  kind          text not null check (kind in ('wwcc', 'police', 'licence', 'other')),
  jurisdiction  text,                     -- 'NSW', 'QLD', 'VIC', 'NZ', 'National'
  number        text,
  issued_on     date,
  expires_on    date,                     -- police checks carry none: the recheck date follows settings
  verified_on   date,
  verified_by   uuid references staff(id),
  outcome       text not null default 'clear' check (outcome in ('clear', 'pending', 'barred', 'withdrawn')),
  note          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (volunteer_id, kind, number)
);

create table if not exists training (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references volunteers(id),
  course        text not null,            -- 'induction', 'child-safe', 'manual-handling', 'food-safety', 'first-aid'
  completed_on  date not null,
  expires_on    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (volunteer_id, course, completed_on)
);

-- ---------------------------------------------------------------- shifts and the roster

create table if not exists shifts (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,       -- SH-2001
  role_id     uuid not null references roles(id),
  location    text,
  shift_on    date not null,
  starts      time not null,
  ends        time not null,
  needed      int not null default 1 check (needed > 0),
  status      text not null default 'open' check (status in ('open', 'cancelled')),
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (ends > starts)
);

create table if not exists assignments (
  id            uuid primary key default gen_random_uuid(),
  shift_id      uuid not null references shifts(id),
  volunteer_id  uuid not null references volunteers(id),
  status        text not null default 'rostered'
                check (status in ('rostered', 'confirmed', 'attended', 'no-show', 'cancelled')),
  rostered_on   date not null default current_date,
  confirmed_on  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (shift_id, volunteer_id)
);

-- Hours given. From an attended shift (approved by the attendance) or logged by
-- the volunteer (pending until a coordinator approves them).
create table if not exists hours (
  id             uuid primary key default gen_random_uuid(),
  volunteer_id   uuid not null references volunteers(id),
  program_id     uuid not null references programs(id),
  role_id        uuid references roles(id),
  assignment_id  uuid unique references assignments(id),
  worked_on      date not null,
  minutes        int not null check (minutes > 0 and minutes <= 960),
  activity       text,
  source         text not null default 'self' check (source in ('shift', 'self', 'import')),
  approved_on    date,
  approved_by    uuid references staff(id),
  import_key     text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists recognitions (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid not null references volunteers(id),
  milestone     text not null,            -- '100 hours', '5 years'
  awarded_on    date not null default current_date,
  how           text,                     -- 'Certificate at the August morning tea'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (volunteer_id, milestone)
);

-- ---------------------------------------------------------------- incidents and notes

create table if not exists incidents (
  id             uuid primary key default gen_random_uuid(),
  ref            text not null unique,    -- INC-01
  occurred_on    date not null,
  program_id     uuid references programs(id),
  volunteer_id   uuid references volunteers(id),
  kind           text not null check (kind in ('injury', 'near miss', 'complaint', 'safeguarding', 'property')),
  description    text not null,
  notifiable     boolean not null default false,  -- a notifiable incident under WHS s35 / HSWA s23
  notified_on    date,                            -- told the regulator
  actions        text,
  closed_on      date,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists notes (
  id            uuid primary key default gen_random_uuid(),
  volunteer_id  uuid references volunteers(id),
  staff_id      uuid references staff(id),
  noted_on      date not null default current_date,
  kind          text not null default 'note' check (kind in ('call', 'email', 'meeting', 'note')),
  body          text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['staff','programs','roles','volunteers','checks','training','shifts','assignments','hours','recognitions','incidents','notes'] loop
    execute format('drop trigger if exists trg_%1$s_touch on %1$s', t);
    execute format('create trigger trg_%1$s_touch before update on %1$s for each row execute function touch_updated_at()', t);
  end loop;
end $$;

create index if not exists idx_checks_volunteer on checks (volunteer_id);
create index if not exists idx_training_volunteer on training (volunteer_id);
create index if not exists idx_assignments_volunteer on assignments (volunteer_id);
create index if not exists idx_hours_volunteer on hours (volunteer_id, worked_on);
create index if not exists idx_shifts_on on shifts (shift_on);

-- ---------------------------------------------------------------- views

-- How a check is said out loud: 'NSW Working with Children check', 'QLD blue card'.
create or replace function check_name(p_kind text, p_jurisdiction text) returns text
language sql immutable as $$
  select case p_kind
    when 'wwcc' then case when p_jurisdiction = 'QLD' then 'QLD blue card'
                          when p_jurisdiction is null then 'Working with Children check'
                          else p_jurisdiction || ' Working with Children check' end
    when 'police' then case when p_jurisdiction = 'NZ' then 'NZ Police vet' else 'police check' end
    when 'licence' then 'driver licence'
    else coalesce(p_kind, 'check') end
$$;


-- Every check with the date it stops counting. A police check with no expiry
-- runs out police_recheck_years after it was issued.
create or replace view v_checks as
select c.id, c.volunteer_id, v.ref as volunteer_ref, v.first_name || ' ' || v.last_name as volunteer, v.status as volunteer_status,
       c.kind, c.jurisdiction, c.number, c.issued_on, c.verified_on, c.outcome,
       coalesce(c.expires_on, case when c.kind = 'police' and c.issued_on is not null
                                   then (c.issued_on + make_interval(years => s.police_recheck_years))::date end) as good_until,
       case
         when c.outcome = 'barred' then 'BARRED'
         when c.outcome = 'pending' then 'PENDING'
         when c.outcome = 'withdrawn' then 'WITHDRAWN'
         when coalesce(c.expires_on, case when c.kind = 'police' and c.issued_on is not null
                                          then (c.issued_on + make_interval(years => s.police_recheck_years))::date end) < current_date then 'EXPIRED'
         when c.verified_on is null then 'NOT VERIFIED'
         when coalesce(c.expires_on, case when c.kind = 'police' and c.issued_on is not null
                                          then (c.issued_on + make_interval(years => s.police_recheck_years))::date end) <= current_date + 60 then 'EXPIRING'
         else 'CURRENT'
       end as state
from checks c join volunteers v on v.id = c.volunteer_id cross join settings s;

-- The latest completion of each course per volunteer.
create or replace view v_training as
select distinct on (t.volunteer_id, t.course)
       t.volunteer_id, t.course, t.completed_on, t.expires_on,
       case when t.expires_on is not null and t.expires_on < current_date then 'EXPIRED'
            when t.expires_on is not null and t.expires_on <= current_date + 60 then 'EXPIRING'
            else 'CURRENT' end as state
from training t
order by t.volunteer_id, t.course, t.completed_on desc;

create or replace view v_shifts as
select sh.id as shift_id, sh.ref, sh.shift_on, sh.starts, sh.ends,
       (extract(epoch from (sh.ends - sh.starts)) / 60)::int as minutes,
       sh.location, sh.needed, sh.status, r.id as role_id, r.ref as role_ref, r.name as role, p.id as program_id, p.name as program,
       st.name as coordinator,
       count(a.id) filter (where a.status in ('rostered', 'confirmed', 'attended'))::int as filled,
       count(a.id) filter (where a.status = 'confirmed')::int as confirmed,
       greatest(sh.needed - count(a.id) filter (where a.status in ('rostered', 'confirmed', 'attended')), 0)::int as gap
from shifts sh join roles r on r.id = sh.role_id join programs p on p.id = r.program_id left join staff st on st.id = p.coordinator_id
left join assignments a on a.shift_id = sh.id
group by sh.id, r.id, p.id, st.name;

-- Why a volunteer may not work a role on a date. Empty means cleared. The
-- roster gate, the gaps finder and v_roster_problems all ask this one question.
create or replace function clearance_problems(p_volunteer uuid, p_role uuid, p_on date)
returns setof text language sql stable as $$
  select 'no current ' || check_name(k, case when k = 'wwcc' then r.state end) || ' through ' || p_on
    from roles r join programs p on p.id = r.program_id
    cross join unnest(r.required_checks || case when p.child_related and not ('wwcc' = any(r.required_checks)) then array['wwcc'] else '{}'::text[] end) k
   where r.id = p_role
     and not exists (select 1 from v_checks c where c.volunteer_id = p_volunteer and c.kind = k and c.outcome = 'clear'
                       and c.verified_on is not null and (c.good_until is null or c.good_until >= p_on)
                       and (k <> 'wwcc' or r.state is null or c.jurisdiction = r.state))
  union all
  select 'no current ' || k || ' training'
    from roles r cross join unnest(r.required_training) k
   where r.id = p_role
     and not exists (select 1 from v_training t where t.volunteer_id = p_volunteer and t.course = k and (t.expires_on is null or t.expires_on >= p_on))
  union all
  select 'a check came back barred' from checks c where c.volunteer_id = p_volunteer and c.outcome = 'barred'
  union all
  select 'volunteer is ' || v.status from volunteers v where v.id = p_volunteer and v.status <> 'active'
  union all
  select 'under ' || r.min_age || ' on the day' from volunteers v, roles r
   where v.id = p_volunteer and r.id = p_role and v.date_of_birth is not null and v.date_of_birth > (p_on - make_interval(years => r.min_age))::date
  union all
  select 'under 18 with no guardian consent' from volunteers v
   where v.id = p_volunteer and v.guardian_consent_on is null and v.date_of_birth is not null and v.date_of_birth > (p_on - interval '18 years')::date
$$;

-- Anyone rostered who would not pass the gate today: the record changed after
-- they were rostered (a check expired, training lapsed, they went inactive).
create or replace view v_roster_problems as
select a.id as assignment_id, sh.ref as shift, sh.shift_on, r.name as role, p.name as program,
       v.ref as volunteer_ref, v.first_name || ' ' || v.last_name as volunteer, pr.problem
from assignments a
join shifts sh on sh.id = a.shift_id join roles r on r.id = sh.role_id join programs p on p.id = r.program_id
join volunteers v on v.id = a.volunteer_id
cross join lateral clearance_problems(v.id, r.id, sh.shift_on) as pr(problem)
where a.status in ('rostered', 'confirmed') and sh.status = 'open' and sh.shift_on >= current_date;

create or replace view v_volunteers as
select v.id as volunteer_id, v.ref, v.first_name || ' ' || v.last_name as name, v.status, v.stage, v.state, v.email, v.phone,
       v.started_on, v.date_of_birth,
       case when v.date_of_birth is null then null else extract(year from age(current_date, v.date_of_birth))::int end as age,
       (select max(sh.shift_on) from assignments a join shifts sh on sh.id = a.shift_id where a.volunteer_id = v.id and a.status = 'attended') as last_shift_on,
       (select max(h.worked_on) from hours h where h.volunteer_id = v.id) as last_hours_on,
       (select min(sh.shift_on) from assignments a join shifts sh on sh.id = a.shift_id where a.volunteer_id = v.id and a.status in ('rostered', 'confirmed') and sh.shift_on >= current_date and sh.status = 'open') as next_shift_on,
       coalesce((select sum(h.minutes) from hours h where h.volunteer_id = v.id and h.approved_on is not null and h.worked_on >= current_date - 365), 0)::int as minutes_12m,
       coalesce((select sum(h.minutes) from hours h where h.volunteer_id = v.id and h.approved_on is not null), 0)::int as minutes_total,
       (select string_agg(check_name(c.kind, c.jurisdiction) || ' ' || c.state, ', ' order by c.kind) from v_checks c where c.volunteer_id = v.id and c.state <> 'CURRENT') as check_flags,
       (select count(*) from v_roster_problems p where p.volunteer_ref = v.ref)::int as roster_problems
from volunteers v;

-- Hours by program and month, approved only.
create or replace view v_program_hours as
select p.id as program_id, p.name as program, p.funder, date_trunc('month', h.worked_on)::date as period,
       count(distinct h.volunteer_id)::int as volunteers, sum(h.minutes)::int as minutes
from hours h join programs p on p.id = h.program_id
where h.approved_on is not null
group by p.id, date_trunc('month', h.worked_on);

-- Milestones earned and not yet recognised: approved hours and years of service.
create or replace view v_milestones as
with earned as (
  select v.volunteer_id, v.ref, v.name, m.hours || ' hours' as milestone, m.hours * 60 as threshold
    from v_volunteers v cross join (values (50), (100), (250), (500), (1000), (2500)) m(hours)
   where v.status = 'active' and v.minutes_total >= m.hours * 60
  union all
  select v.volunteer_id, v.ref, v.name, y.years || ' years', null
    from v_volunteers v cross join (values (1), (5), (10), (15), (20), (25)) y(years)
   where v.status = 'active' and v.started_on is not null and v.started_on <= (current_date - make_interval(years => y.years))::date
)
select e.* from earned e
where not exists (select 1 from recognitions r where r.volunteer_id = e.volunteer_id and r.milestone = e.milestone);

create or replace view v_attention as
select 1 as rank, 'ROSTERED WITHOUT CLEARANCE' as reason, p.shift as label, p.volunteer as who, p.program,
       (p.shift_on - current_date) as days, p.role || ' on ' || p.shift_on || ': ' || p.problem as detail
from v_roster_problems p
union all
select 1, 'CHECK BARRED', c.volunteer_ref, c.volunteer, null, null,
       check_name(c.kind, c.jurisdiction) || ' ' || coalesce(c.number, '') || ': outcome barred, volunteer still ' || c.volunteer_status
from v_checks c where c.state = 'BARRED' and c.volunteer_status in ('active', 'applicant')
union all
select 1, 'NOTIFIABLE INCIDENT', i.ref, coalesce(v.first_name || ' ' || v.last_name, ''), p.name, current_date - i.occurred_on,
       i.kind || ' on ' || i.occurred_on || ', regulator not yet notified: ' || i.description
from incidents i left join volunteers v on v.id = i.volunteer_id left join programs p on p.id = i.program_id
where i.notifiable and i.notified_on is null
union all
select 2, 'CHECK EXPIRED', c.volunteer_ref, c.volunteer, null, current_date - c.good_until,
       check_name(c.kind, c.jurisdiction) || ' expired ' || c.good_until
from v_checks c where c.state = 'EXPIRED' and c.volunteer_status = 'active'
  and not exists (select 1 from v_checks c2 where c2.volunteer_id = c.volunteer_id and c2.kind = c.kind and c2.state in ('CURRENT', 'EXPIRING', 'NOT VERIFIED', 'PENDING'))
union all
select 2, 'SHIFT SHORT', s.ref, s.coordinator, s.program, s.shift_on - current_date,
       s.role || ' ' || s.shift_on || ' ' || to_char(s.starts, 'HH24:MI') || ': ' || s.filled || ' of ' || s.needed || ' rostered'
from v_shifts s where s.status = 'open' and s.gap > 0 and s.shift_on between current_date and current_date + 7
union all
select 2, 'CHECK NOT VERIFIED', c.volunteer_ref, c.volunteer, null, current_date - c.issued_on,
       check_name(c.kind, c.jurisdiction) || ' ' || coalesce(c.number, '') || ' recorded but not verified with the issuer'
from v_checks c where c.state = 'NOT VERIFIED' and c.volunteer_status in ('active', 'applicant')
union all
select 2, 'INCIDENT OPEN', i.ref, coalesce(v.first_name || ' ' || v.last_name, ''), p.name, current_date - i.occurred_on,
       i.kind || ': ' || i.description
from incidents i left join volunteers v on v.id = i.volunteer_id left join programs p on p.id = i.program_id
where i.closed_on is null and not (i.notifiable and i.notified_on is null) and i.occurred_on <= current_date - 14
union all
select 3, 'CHECK EXPIRING', c.volunteer_ref, c.volunteer, null, c.good_until - current_date,
       check_name(c.kind, c.jurisdiction) || ' expires ' || c.good_until
from v_checks c where c.state = 'EXPIRING' and c.volunteer_status = 'active'
union all
select 3, 'HOURS TO APPROVE', v.ref, v.first_name || ' ' || v.last_name, p.name, current_date - min(h.worked_on),
       count(*) || ' entr' || case when count(*) = 1 then 'y' else 'ies' end || ', ' || round(sum(h.minutes) / 60.0, 1) || 'h logged, oldest ' || min(h.worked_on)
from hours h join volunteers v on v.id = h.volunteer_id join programs p on p.id = h.program_id
where h.approved_on is null group by v.id, p.name having min(h.worked_on) <= current_date - 7
union all
select 3, 'APPLICANT WAITING', v.ref, v.first_name || ' ' || v.last_name, null, current_date - greatest(v.applied_on, v.interviewed_on, v.references_ok_on),
       'stage ' || v.stage || ' since ' || greatest(v.applied_on, v.interviewed_on, v.references_ok_on)
from volunteers v where v.status = 'applicant' and greatest(v.applied_on, v.interviewed_on, v.references_ok_on) <= current_date - 14
union all
select 3, 'UNDER 18 NO CONSENT', v.ref, v.name, null, v.age, 'aged ' || v.age || ', no guardian consent on record'
from v_volunteers v join volunteers x on x.id = v.volunteer_id
where v.status in ('active', 'applicant') and v.age < 18 and x.guardian_consent_on is null
union all
select 4, 'LAPSING', v.ref, v.name, null, current_date - greatest(v.last_shift_on, v.last_hours_on, v.started_on),
       'no shift or hours since ' || greatest(v.last_shift_on, v.last_hours_on, v.started_on) || ', nothing rostered'
from v_volunteers v cross join settings s
where v.status = 'active' and v.next_shift_on is null
  and greatest(v.last_shift_on, v.last_hours_on, v.started_on) <= current_date - s.quiet_after_days
union all
select 4, 'MILESTONE', m.ref, m.name, null, null, m.milestone || ' reached, not yet recognised'
from v_milestones m
union all
select 4, 'NOT CONFIRMED', s.ref, v.first_name || ' ' || v.last_name, s.program, s.shift_on - current_date,
       s.role || ' ' || s.shift_on || ' ' || to_char(s.starts, 'HH24:MI') || ', rostered, not confirmed'
from assignments a join v_shifts s on s.shift_id = a.shift_id join volunteers v on v.id = a.volunteer_id
where a.status = 'rostered' and s.status = 'open' and s.shift_on between current_date and current_date + 2;
