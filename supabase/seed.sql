-- Demo data: Northside Community Care, a fictional Sydney charity with a Gold
-- Coast mentoring branch. Five programs (op shops, community meals, youth
-- mentoring, hospital visiting, events), 24 volunteers and seven months of
-- shifts and hours. Every date is relative to today, every row has a unique
-- key, and every insert is ON CONFLICT DO NOTHING, so re-running this is harmless.
--
-- A week going quietly wrong, on purpose:
--   * Josh is rostered to mentor on Thursday, and his NSW Working with Children check expired ten days ago
--   * Priya is rostered in the kitchen tomorrow, and her food safety training lapsed two weeks ago
--   * Peter fractured his wrist on a wet ramp three days ago, was admitted, is paused, and the regulator has not been told
--   * Kevin's police check runs out in 20 days, and he drives tomorrow, rostered but not confirmed
--   * Saturday's sorting room needs four and has one; the ward visit and the Gold Coast mentoring are short too
--   * Grace's Queensland blue card is recorded but nobody has verified it
--   * Mark's NSW Working with Children check came back barred and his application is still open
--   * Noah is 16 and active with no guardian consent on file
--   * Sienna has waited three weeks at the reference stage
--   * Tom's twelve-day-old event hours are still waiting for approval
--   * Ian and Fiona have quietly stopped coming
--   * Margaret reached ten years, and Helen reached 500 hours, and nobody has said thank you

update settings set org_name = 'Northside Community Care' where id = 1 and org_name = 'Your organisation';

insert into staff (name, role, email) values
  ('Rachel Moss',   'Volunteer manager',          'rachel@northsidecare.example'),
  ('Sanjay Patel',  'Op shops coordinator',       'sanjay@northsidecare.example'),
  ('Tim Okafor',    'Community meals coordinator','tim@northsidecare.example'),
  ('Leah Brandt',   'Youth mentoring coordinator','leah@northsidecare.example'),
  ('Kirsty Dunn',   'Gold Coast coordinator',     'kirsty@northsidecare.example')
on conflict (name) do nothing;

insert into programs (ref, name, coordinator_id, child_related, funder) values
  ('PR-01', 'Op shops',           (select id from staff where name = 'Sanjay Patel'), false, null),
  ('PR-02', 'Community meals',    (select id from staff where name = 'Tim Okafor'),   false, 'Northern Beaches Council community grant'),
  ('PR-03', 'Youth mentoring',    (select id from staff where name = 'Leah Brandt'),  true,  'NSW Department of Communities and Justice'),
  ('PR-04', 'Hospital visiting',  (select id from staff where name = 'Rachel Moss'),  false, null),
  ('PR-05', 'Events',             (select id from staff where name = 'Rachel Moss'),  false, null)
on conflict (ref) do nothing;

insert into roles (ref, program_id, name, state, min_age, required_checks, required_training) values
  ('R-101', (select id from programs where ref = 'PR-01'), 'Shop assistant',          'NSW', 15, '{}',                 '{induction}'),
  ('R-102', (select id from programs where ref = 'PR-01'), 'Sorting room',            'NSW', 16, '{}',                 '{induction,manual-handling}'),
  ('R-201', (select id from programs where ref = 'PR-02'), 'Driver',                  'NSW', 18, '{police,licence}',   '{induction}'),
  ('R-202', (select id from programs where ref = 'PR-02'), 'Kitchen hand',            'NSW', 16, '{}',                 '{induction,food-safety}'),
  ('R-301', (select id from programs where ref = 'PR-03'), 'Homework mentor',         'NSW', 18, '{wwcc,police}',      '{induction,child-safe}'),
  ('R-302', (select id from programs where ref = 'PR-03'), 'Homework mentor (Gold Coast)', 'QLD', 18, '{wwcc,police}', '{induction,child-safe}'),
  ('R-401', (select id from programs where ref = 'PR-04'), 'Ward visitor',            'NSW', 18, '{police}',           '{induction,infection-control}'),
  ('R-501', (select id from programs where ref = 'PR-05'), 'Event crew',              'NSW', 14, '{}',                 '{induction}')
on conflict (ref) do nothing;

insert into volunteers (ref, first_name, last_name, email, phone, date_of_birth, suburb, state, status, stage,
                        applied_on, interviewed_on, references_ok_on, started_on, ended_on, end_reason,
                        guardian_name, guardian_consent_on, emergency_contact, availability, interests, source) values
  ('V-1001', 'Margaret', 'Ellis',       'margaret.ellis@example.com',   '0412 001 001', current_date - 26050, 'Manly',          'NSW', 'active',    'done',        current_date - 3700, current_date - 3690, current_date - 3685, current_date - 3680, null, null, null, null, 'Don Ellis 0412 001 101',     'Tuesdays',          'Op shop, sorting',       'Walk in'),
  ('V-1002', 'Graham',   'Pike',        'graham.pike@example.com',      '0412 001 002', current_date - 24500, 'Dee Why',        'NSW', 'active',    'done',        current_date - 2215, current_date - 2210, current_date - 2205, current_date - 2200, null, null, null, null, 'Sue Pike 0412 001 102',      'Saturdays',         'Sorting, furniture',     'Friend'),
  ('V-1003', 'Helen',    'Achterberg',  'helen.a@example.com',          '0412 001 003', current_date - 23400, 'Mona Vale',      'NSW', 'active',    'done',        current_date - 2930, current_date - 2925, current_date - 2920, current_date - 2915, null, null, null, null, 'Pieter Achterberg 0412 001 103', 'Wednesdays',    'Driving',                'Website'),
  ('V-1004', 'Kevin',    'Doyle',       'kevin.doyle@example.com',      '0412 001 004', current_date - 21200, 'Narrabeen',      'NSW', 'active',    'done',        current_date - 1120, current_date - 1115, current_date - 1110, current_date - 1095, null, null, null, null, 'Anne Doyle 0412 001 104',    'Wednesdays',        'Driving',                'Seek Volunteer'),
  ('V-1005', 'Priya',    'Raman',       'priya.raman@example.com',      '0412 001 005', current_date - 10600, 'Brookvale',      'NSW', 'active',    'done',        current_date - 1130, current_date - 1125, current_date - 1120, current_date - 1110, null, null, null, null, 'Arun Raman 0412 001 105',    'Wednesday mornings','Cooking',                'Website'),
  ('V-1006', 'Josh',     'Kemp',        'josh.kemp@example.com',        '0412 001 006', current_date - 8800,  'Manly',          'NSW', 'active',    'done',        current_date - 1900, current_date - 1895, current_date - 1890, current_date - 1880, null, null, null, null, 'Lisa Kemp 0412 001 106',     'Thursday afternoons','Maths tutoring',        'University'),
  ('V-1007', 'Amelia',   'Tran',        'amelia.tran@example.com',      '0412 001 007', current_date - 11400, 'Freshwater',     'NSW', 'active',    'done',        current_date - 800,  current_date - 795,  current_date - 790,  current_date - 780,  null, null, null, null, 'Bao Tran 0412 001 107',      'Thursday afternoons','Reading, English',      'Friend'),
  ('V-1008', 'Daniel',   'Fraser',      'daniel.fraser@example.com',    '0412 001 008', current_date - 16500, 'Collaroy',       'NSW', 'active',    'done',        current_date - 600,  current_date - 595,  current_date - 590,  current_date - 580,  null, null, null, null, 'Kate Fraser 0412 001 108',   'Thursday afternoons','Science',               'Website'),
  ('V-1009', 'Noah',     'Williams',    'noah.williams@example.com',    '0412 001 009', current_date - 5950,  'Curl Curl',      'NSW', 'active',    'done',        current_date - 90,   current_date - 85,   current_date - 80,   current_date - 60,   null, null, null, null, 'Emma Williams 0412 001 109', 'Weekends',          'Events',                 'School'),
  ('V-1010', 'Ruby',     'Chen',        'ruby.chen@example.com',        '0412 001 010', current_date - 6300,  'Manly',          'NSW', 'active',    'done',        current_date - 120,  current_date - 115,  current_date - 110,  current_date - 100,  null, null, 'Wei Chen', current_date - 112, 'Wei Chen 0412 001 110', 'Weekends',     'Events, beach clean-ups','School'),
  ('V-1011', 'Barbara',  'Quinn',       'barbara.quinn@example.com',    '0412 001 011', current_date - 27800, 'Balgowlah',      'NSW', 'active',    'done',        current_date - 1500, current_date - 1495, current_date - 1490, current_date - 1480, null, null, null, null, 'Neil Quinn 0412 001 111',    'Monday mornings',   'Hospital visiting',      'Church'),
  ('V-1012', 'Ian',      'McLeod',      'ian.mcleod@example.com',       '0412 001 012', current_date - 25300, 'Seaforth',       'NSW', 'active',    'done',        current_date - 1300, current_date - 1295, current_date - 1290, current_date - 1280, null, null, null, null, 'Morag McLeod 0412 001 112',  'Monday mornings',   'Hospital visiting',      'Church'),
  ('V-1013', 'Fiona',    'Walsh',       'fiona.walsh@example.com',      '0412 001 013', current_date - 19000, 'Avalon',         'NSW', 'active',    'done',        current_date - 700,  current_date - 695,  current_date - 690,  current_date - 680,  null, null, null, null, 'Rob Walsh 0412 001 113',     'Saturdays',         'Sorting',                'Website'),
  ('V-1014', 'Tom',      'Baxter',      'tom.baxter@example.com',       '0412 001 014', current_date - 14000, 'Dee Why',        'NSW', 'active',    'done',        current_date - 400,  current_date - 395,  current_date - 390,  current_date - 380,  null, null, null, null, 'Jess Baxter 0412 001 114',   'Tuesdays, events',  'Retail, events',         'Seek Volunteer'),
  ('V-1015', 'Lucy',     'Harrington',  'lucy.h@example.com',           '0412 001 015', current_date - 8100,  'Manly',          'NSW', 'active',    'done',        current_date - 200,  current_date - 195,  current_date - 190,  current_date - 180,  null, null, null, null, 'Mark Harrington 0412 001 115','Weekends',         'Events',                 'Instagram'),
  ('V-1016', 'Peter',    'Novak',       'peter.novak@example.com',      '0412 001 016', current_date - 22600, 'Frenchs Forest', 'NSW', 'inactive',    'done',        current_date - 900,  current_date - 895,  current_date - 890,  current_date - 880,  null, null, null, null, 'Hana Novak 0412 001 116',    'Wednesdays',        'Driving',                'Friend'),
  ('V-1017', 'Grace',    'Kim',         'grace.kim@example.com',        '0412 001 017', current_date - 9900,  'Southport',      'QLD', 'applicant', 'checks',      current_date - 25,   current_date - 18,   current_date - 12,   null, null, null, null, null, 'Daniel Kim 0412 001 117',    'Thursday afternoons','Mentoring',             'Website'),
  ('V-1018', 'Liam',     'O''Connor',   'liam.oconnor@example.com',     '0412 001 018', current_date - 12500, 'Burleigh Heads', 'QLD', 'active',    'done',        current_date - 500,  current_date - 495,  current_date - 490,  current_date - 480,  null, null, null, null, 'Erin O''Connor 0412 001 118','Thursday afternoons','Mentoring, sport',      'Friend'),
  ('V-1019', 'Sienna',   'Moore',       'sienna.moore@example.com',     '0412 001 019', current_date - 7000,  'Manly',          'NSW', 'applicant', 'references',  current_date - 30,   current_date - 21,   null, null, null, null, null, null, 'Claire Moore 0412 001 119',  'Thursday afternoons','Mentoring',             'University'),
  ('V-1020', 'Mark',     'Jessop',      'mark.jessop@example.com',      '0412 001 020', current_date - 17200, 'Dee Why',        'NSW', 'applicant', 'checks',      current_date - 28,   current_date - 22,   current_date - 20,   null, null, null, null, null, null,                         'Thursday afternoons','Mentoring',             'Website'),
  ('V-1021', 'Olivia',   'Grant',       'olivia.grant@example.com',     '0412 001 021', current_date - 12800, 'Narrabeen',      'NSW', 'applicant', 'applied',     current_date - 3,    null, null, null, null, null, null, null, null,                                     'Saturdays',         'Op shop',                'Website'),
  ('V-1022', 'Ahmed',    'Siddiqui',    'ahmed.siddiqui@example.com',   '0412 001 022', current_date - 15000, 'Brookvale',      'NSW', 'active',    'done',        current_date - 260,  current_date - 255,  current_date - 250,  current_date - 240,  null, null, null, null, 'Sara Siddiqui 0412 001 122', 'Wednesday mornings','Cooking',                'Mosque'),
  ('V-1023', 'Jenny',    'Lowe',        'jenny.lowe@example.com',       '0412 001 023', current_date - 24100, 'Mona Vale',      'NSW', 'inactive',  'done',        current_date - 1000, current_date - 995,  current_date - 990,  current_date - 980,  null, null, null, null, 'Bill Lowe 0412 001 123',     'Saturdays',         'Sorting',                'Friend'),
  ('V-1024', 'Robert',   'Hale',        'robert.hale@example.com',      '0412 001 024', current_date - 26700, 'Manly',          'NSW', 'former',    'done',        current_date - 2400, current_date - 2395, current_date - 2390, current_date - 2380, current_date - 200, 'Moved to Port Macquarie', null, null, null, 'Wednesdays', 'Driving', 'Church')
on conflict (ref) do nothing;

-- ---------------------------------------------------------------- checks

insert into checks (volunteer_id, kind, jurisdiction, number, issued_on, expires_on, verified_on, verified_by, outcome)
select v.id, c.kind, c.jurisdiction, c.number, current_date + c.issued, case when c.expires is null then null else current_date + c.expires end,
       case when c.verified is null then null else current_date + c.verified end, (select id from staff where name = c.by), c.outcome
from (values
  ('V-1003', 'police',  'National', 'NPC-3003', -400,  null,  -398,  'Tim Okafor',  'clear'),
  ('V-1003', 'licence', 'NSW',      'LIC-3003', -900,  1200,  -398,  'Tim Okafor',  'clear'),
  ('V-1004', 'police',  'National', 'NPC-3004', -1076, null,  -1074, 'Tim Okafor',  'clear'),
  ('V-1004', 'licence', 'NSW',      'LIC-3004', -700,  1100,  -1074, 'Tim Okafor',  'clear'),
  ('V-1016', 'police',  'National', 'NPC-3016', -880,  null,  -878,  'Tim Okafor',  'clear'),
  ('V-1016', 'licence', 'NSW',      'LIC-3016', -300,  1500,  -878,  'Tim Okafor',  'clear'),
  ('V-1024', 'police',  'National', 'NPC-3024', -1500, null,  -1498, 'Tim Okafor',  'clear'),
  ('V-1006', 'wwcc',    'NSW',      'WWC0661234V', -1836, -10, -1830, 'Leah Brandt', 'clear'),
  ('V-1006', 'police',  'National', 'NPC-3006', -700,  null,  -698,  'Leah Brandt', 'clear'),
  ('V-1007', 'wwcc',    'NSW',      'WWC0778812V', -790, 1035, -785,  'Leah Brandt', 'clear'),
  ('V-1007', 'police',  'National', 'NPC-3007', -790,  null,  -785,  'Leah Brandt', 'clear'),
  ('V-1008', 'wwcc',    'NSW',      'WWC0812290V', -590, 1235, -585,  'Leah Brandt', 'clear'),
  ('V-1008', 'police',  'National', 'NPC-3008', -590,  null,  -585,  'Leah Brandt', 'clear'),
  ('V-1018', 'wwcc',    'QLD',      'BC1188201',  -490, 605,  -486,  'Kirsty Dunn', 'clear'),
  ('V-1018', 'police',  'National', 'NPC-3018', -490,  null,  -486,  'Kirsty Dunn', 'clear'),
  ('V-1017', 'wwcc',    'QLD',      'BC1172040',  -9,   1086, null,  null,          'clear'),
  ('V-1017', 'police',  'National', 'NPC-3017', -8,    null,  -6,    'Kirsty Dunn', 'clear'),
  ('V-1011', 'police',  'National', 'NPC-3011', -500,  null,  -498,  'Rachel Moss', 'clear'),
  ('V-1012', 'police',  'National', 'NPC-3012', -600,  null,  -598,  'Rachel Moss', 'clear'),
  ('V-1020', 'wwcc',    'NSW',      'WWC0900120V', -10, null, -9,    'Leah Brandt', 'barred')
) c(vref, kind, jurisdiction, number, issued, expires, verified, by, outcome)
join volunteers v on v.ref = c.vref
on conflict (volunteer_id, kind, number) do nothing;

-- ---------------------------------------------------------------- training

-- Everyone who has started did the induction on their first day.
insert into training (volunteer_id, course, completed_on)
select id, 'induction', started_on from volunteers where started_on is not null
on conflict (volunteer_id, course, completed_on) do nothing;

insert into training (volunteer_id, course, completed_on, expires_on)
select v.id, t.course, current_date + t.done, case when t.expires is null then null else current_date + t.expires end
from (values
  ('V-1002', 'manual-handling', -400,  null),
  ('V-1013', 'manual-handling', -650,  null),
  ('V-1023', 'manual-handling', -950,  null),
  ('V-1005', 'food-safety',     -1110, -15),
  ('V-1022', 'food-safety',     -235,  860),
  ('V-1006', 'child-safe',      -300,  430),
  ('V-1007', 'child-safe',      -780,  -50),
  ('V-1007', 'child-safe',      -40,   690),
  ('V-1008', 'child-safe',      -580,  150),
  ('V-1018', 'child-safe',      -480,  250),
  ('V-1011', 'infection-control', -160, 205),
  ('V-1012', 'infection-control', -300, 65)
) t(vref, course, done, expires)
join volunteers v on v.ref = t.vref
on conflict (volunteer_id, course, completed_on) do nothing;

-- ---------------------------------------------------------------- seven months of past shifts

-- Every role ran once a week. Its slot: how many days back from the week's end,
-- the hours, and how many it needs.
insert into shifts (ref, role_id, location, shift_on, starts, ends, needed)
select 'SH-' || substr(r.ref, 3) || '-' || lpad(w::text, 2, '0'), r.id, s.location,
       current_date - (w * 7 + s.dayoff), s.starts::time, s.ends::time, s.needed
from (values
  ('R-101', 2, '09:00', '13:00', 2, 'Manly op shop'),
  ('R-102', 5, '09:00', '12:00', 4, 'Dee Why sorting room'),
  ('R-201', 1, '10:00', '13:00', 2, 'Brookvale kitchen'),
  ('R-202', 1, '08:30', '11:30', 2, 'Brookvale kitchen'),
  ('R-301', 3, '15:30', '17:30', 3, 'Manly library'),
  ('R-302', 3, '15:30', '17:30', 2, 'Southport community centre'),
  ('R-401', 4, '10:00', '12:00', 2, 'Northern Beaches Hospital'),
  ('R-501', 6, '08:00', '12:00', 6, 'Various')
) s(role_ref, dayoff, starts, ends, needed, location)
join roles r on r.ref = s.role_ref
cross join generate_series(1, 30) w
on conflict (ref) do nothing;

-- Who came, week by week. Every eleventh week or so somebody did not turn up.
insert into assignments (shift_id, volunteer_id, status, rostered_on, confirmed_on)
select sh.id, v.id,
       case when (w + substr(v.ref, 3)::int) % 11 = 0 then 'no-show' else 'attended' end,
       sh.shift_on - 7, sh.shift_on - 2
from (values
  ('V-1001', 'R-101', 1, 30), ('V-1002', 'R-102', 1, 30), ('V-1003', 'R-201', 1, 30), ('V-1004', 'R-201', 1, 30),
  ('V-1005', 'R-202', 1, 26), ('V-1006', 'R-301', 1, 20), ('V-1007', 'R-301', 1, 30), ('V-1008', 'R-301', 2, 30),
  ('V-1009', 'R-501', 1, 6),  ('V-1010', 'R-501', 1, 10), ('V-1011', 'R-401', 1, 30), ('V-1012', 'R-401', 15, 30),
  ('V-1013', 'R-102', 14, 25),('V-1014', 'R-101', 1, 12), ('V-1015', 'R-501', 1, 8),  ('V-1016', 'R-201', 2, 30),
  ('V-1018', 'R-302', 1, 16), ('V-1022', 'R-202', 1, 18), ('V-1023', 'R-102', 20, 30),('V-1024', 'R-201', 29, 30)
) a(vref, role_ref, first_week, last_week)
join volunteers v on v.ref = a.vref
cross join generate_series(1, 30) w
join shifts sh on sh.ref = 'SH-' || substr(a.role_ref, 3) || '-' || lpad(w::text, 2, '0')
where w between a.first_week and a.last_week
on conflict (shift_id, volunteer_id) do nothing;

-- An attended shift is its own hours record, approved by the attendance.
insert into hours (volunteer_id, program_id, role_id, assignment_id, worked_on, minutes, activity, source, approved_on, approved_by)
select a.volunteer_id, r.program_id, r.id, a.id, sh.shift_on, (extract(epoch from (sh.ends - sh.starts)) / 60)::int, r.name, 'shift',
       sh.shift_on, p.coordinator_id
from assignments a join shifts sh on sh.id = a.shift_id join roles r on r.id = sh.role_id join programs p on p.id = r.program_id
where a.status = 'attended'
on conflict (assignment_id) do nothing;

-- Years of hours from before the seven months, as Better Impact would export them.
insert into hours (volunteer_id, program_id, role_id, worked_on, minutes, activity, source, approved_on, import_key)
select v.id, r.program_id, r.id, current_date - (220 + n * 7), h.minutes, r.name, 'import', current_date - (220 + n * 7),
       'hist-' || v.ref || '-' || n
from (values ('V-1001', 'R-101', 160, 240), ('V-1002', 'R-102', 140, 180), ('V-1003', 'R-201', 145, 180),
             ('V-1011', 'R-401', 120, 120), ('V-1012', 'R-401', 90, 120), ('V-1004', 'R-201', 70, 180)) h(vref, role_ref, weeks, minutes)
join volunteers v on v.ref = h.vref join roles r on r.ref = h.role_ref
cross join generate_series(1, 400) n
where n <= h.weeks
on conflict (import_key) do nothing;

-- Hours a volunteer logged themselves, waiting for a coordinator.
insert into hours (volunteer_id, program_id, role_id, worked_on, minutes, activity, source, import_key)
select v.id, r.program_id, r.id, current_date + x.days, x.minutes, x.activity, 'self', x.key
from (values
  ('V-1014', 'R-501', -12, 300, 'Spring fair setup and pack down', 'self-V-1014-1'),
  ('V-1014', 'R-501', -11, 180, 'Spring fair stall',               'self-V-1014-2'),
  ('V-1015', 'R-501', -3,  240, 'Dee Why beach clean-up',          'self-V-1015-1')
) x(vref, role_ref, days, minutes, activity, key)
join volunteers v on v.ref = x.vref join roles r on r.ref = x.role_ref
on conflict (import_key) do nothing;

-- Milestones already marked, all but the two nobody has got to yet.
insert into recognitions (volunteer_id, milestone, awarded_on, how)
select m.volunteer_id, m.milestone, current_date - 30, 'Certificate at the volunteer morning tea'
from v_milestones m
where not (m.ref = 'V-1001' and m.milestone = '10 years') and not (m.ref = 'V-1003' and m.milestone = '500 hours')
on conflict (volunteer_id, milestone) do nothing;

-- ---------------------------------------------------------------- the coming fortnight

insert into shifts (ref, role_id, location, shift_on, starts, ends, needed, note)
select s.ref, r.id, s.location, current_date + s.days, s.starts::time, s.ends::time, s.needed, s.note
from (values
  ('SH-2001', 'R-301', 2,  '15:30', '17:30', 3, 'Manly library',              null),
  ('SH-2002', 'R-201', 1,  '10:00', '13:00', 2, 'Brookvale kitchen',          '38 meals across Narrabeen and Collaroy'),
  ('SH-2003', 'R-202', 1,  '08:30', '11:30', 2, 'Brookvale kitchen',          null),
  ('SH-2004', 'R-102', 4,  '09:00', '12:00', 4, 'Dee Why sorting room',       'Winter coat drive drop-off'),
  ('SH-2005', 'R-101', 3,  '09:00', '13:00', 2, 'Manly op shop',              null),
  ('SH-2006', 'R-401', 5,  '10:00', '12:00', 2, 'Northern Beaches Hospital',  null),
  ('SH-2007', 'R-501', 10, '08:00', '12:00', 6, 'Shelly Beach',               'Beach clean-up with the surf club'),
  ('SH-2008', 'R-302', 2,  '15:30', '17:30', 2, 'Southport community centre', null),
  ('SH-2009', 'R-201', 8,  '10:00', '13:00', 2, 'Brookvale kitchen',          null)
) s(ref, role_ref, days, starts, ends, needed, location, note)
join roles r on r.ref = s.role_ref
on conflict (ref) do nothing;

insert into assignments (shift_id, volunteer_id, status, rostered_on, confirmed_on)
select sh.id, v.id, a.status, current_date - 6, case when a.status = 'confirmed' then current_date - 1 end
from (values
  ('SH-2001', 'V-1006', 'confirmed'), ('SH-2001', 'V-1007', 'confirmed'), ('SH-2001', 'V-1008', 'confirmed'),
  ('SH-2002', 'V-1004', 'rostered'),  ('SH-2002', 'V-1003', 'confirmed'),
  ('SH-2003', 'V-1005', 'confirmed'), ('SH-2003', 'V-1022', 'confirmed'),
  ('SH-2004', 'V-1002', 'confirmed'),
  ('SH-2005', 'V-1001', 'confirmed'), ('SH-2005', 'V-1014', 'confirmed'),
  ('SH-2006', 'V-1011', 'confirmed'),
  ('SH-2007', 'V-1010', 'rostered'),  ('SH-2007', 'V-1015', 'rostered'),
  ('SH-2008', 'V-1018', 'confirmed'),
  ('SH-2009', 'V-1003', 'rostered')
) a(shift_ref, vref, status)
join shifts sh on sh.ref = a.shift_ref join volunteers v on v.ref = a.vref
on conflict (shift_id, volunteer_id) do nothing;

-- ---------------------------------------------------------------- incidents and notes

insert into incidents (ref, occurred_on, program_id, volunteer_id, kind, description, notifiable, notified_on, actions, closed_on)
select i.ref, current_date + i.days, p.id, v.id, i.kind, i.description, i.notifiable, null, i.actions,
       case when i.closed is null then null else current_date + i.closed end
from (values
  ('INC-01', -40, 'PR-01', 'V-1014', 'complaint', 'Customer complaint about a price tag argument at the Manly shop', false, 'Spoke with both, pricing guide reprinted', -35),
  ('INC-02', -20, 'PR-01', 'V-1002', 'near miss', 'Stack of donation boxes fell from the top shelf in the sorting room, nobody hurt', false, 'Top shelf taped off, waiting on new shelving', null),
  ('INC-03', -3,  'PR-02', 'V-1016', 'injury',    'Slipped on the wet loading ramp unloading meal crates; fractured wrist, admitted to hospital overnight', true, null, null)
) i(ref, days, program_ref, vref, kind, description, notifiable, actions, closed)
join programs p on p.ref = i.program_ref left join volunteers v on v.ref = i.vref
on conflict (ref) do nothing;

insert into notes (volunteer_id, staff_id, noted_on, kind, body)
select v.id, s.id, current_date + n.days, n.kind, n.body
from (values
  ('V-1016', 'Tim Okafor',  -2,  'call',    'Called Peter in hospital. Wrist pinned, off driving for at least six weeks, so paused until then. Wants to come back.'),
  ('V-1012', 'Rachel Moss', -60, 'call',    'Ian said his knee is playing up and he would ring when he is ready to come back.'),
  ('V-1019', 'Leah Brandt', -21, 'meeting', 'Interviewed Sienna. Strong fit for mentoring. Two referees named, not yet contacted.'),
  ('V-1006', 'Leah Brandt', -40, 'email',   'Reminded Josh his Working with Children check renews this month.'),
  ('V-1020', 'Leah Brandt', -9,  'note',    'Working with Children check outcome received. Passed to Rachel to decide on the application.')
) n(vref, staff, days, kind, body)
join volunteers v on v.ref = n.vref join staff s on s.name = n.staff
where not exists (select 1 from notes x where x.volunteer_id = v.id and x.body = n.body);
