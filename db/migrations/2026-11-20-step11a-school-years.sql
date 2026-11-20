-- Step 11a: school years.
-- Each school has years (2026–27, 2027–28...). Exactly one is active: the family
-- portal shows only that one. A new year is prepared out of sight (preparing)
-- and switched on with a button; the old one is then archived, which the school
-- can look at and families cannot.
-- Content that belongs to a year carries its year_id. Families, accounts,
-- children and staff accounts belong to the school and do not change.
-- The year's settings (contact details, look, modules, page texts, calendar
-- PDF) live on the year. The old copies on "schools" are no longer read.
create table if not exists school_years (
  id                   serial primary key,
  school_id            integer not null references schools(id) on delete cascade,
  label                text not null,                          -- e.g. 2026–27
  starts_on            date not null,
  ends_on              date not null,
  status               text not null default 'preparing' check (status in ('preparing', 'active', 'archived')),
  created_at           timestamptz not null default now(),
  created_by           text not null default '',
  copied_from          integer references school_years(id) on delete set null,
  activated_at         timestamptz,
  archived_at          timestamptz,
  -- Settings of the year
  logo_url             text not null default '',
  logo_key             text not null default '',
  panel_theme          jsonb not null default '{}'::jsonb,
  modules              text[] not null default '{families,requests}',
  phone_display        text not null default '',
  phone_href           text not null default '',
  email                text not null default '',
  office_hours         text not null default '',
  address              text not null default '',
  google_calendar_id   text not null default '',
  notice_auto_days     integer not null default 14,
  calendar_pdf_url     text not null default '',
  calendar_pdf_label   text not null default '',
  volunteer_title      text not null default '',
  volunteer_lead       text not null default '',
  volunteer_intro_html text not null default '',
  staff_title          text not null default '',
  staff_lead           text not null default '',
  staff_intro_html     text not null default '',
  staff_teams          jsonb not null default '[]',
  wishlist_title       text not null default '',
  wishlist_lead        text not null default '',
  wishlist_intro_html  text not null default '',
  wishlist_groups      jsonb not null default '[]',
  unique (school_id, label),
  check (ends_on > starts_on)
);
create unique index if not exists school_years_one_active on school_years(school_id) where status = 'active';
create unique index if not exists school_years_one_preparing on school_years(school_id) where status = 'preparing';

-- The school's grades in order, for moving children up a grade.
alter table schools add column if not exists grades jsonb not null default
  '["Preschool", "Pre-K", "Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade", "7th grade", "8th grade"]';

-- Children who left the school stay on record but are no longer listed.
alter table children add column if not exists left_school boolean not null default false;

-- A child's grade and teacher in each year. For the active year it mirrors
-- children.grade/teacher; for a year being prepared it is the planned grade
-- (applied when the year is switched on); for an archived year, what it was.
create table if not exists child_years (
  child_id   integer not null references children(id) on delete cascade,
  year_id    integer not null references school_years(id) on delete cascade,
  grade      text not null default '',
  teacher    text not null default '',
  leaves     boolean not null default false,              -- planned: leaves the school
  primary key (child_id, year_id)
);
create index if not exists child_years_year on child_years(year_id);

-- Every school gets its current year, as active, with the settings it has today.
-- 2026–27 runs from 1 July 2026 to 30 June 2027 (dates can be changed in the panel).
insert into school_years (school_id, label, starts_on, ends_on, status, activated_at,
  logo_url, logo_key, panel_theme, modules, phone_display, phone_href, email, office_hours, address,
  google_calendar_id, notice_auto_days, calendar_pdf_url, calendar_pdf_label,
  volunteer_title, volunteer_lead, volunteer_intro_html, staff_title, staff_lead, staff_intro_html, staff_teams,
  wishlist_title, wishlist_lead, wishlist_intro_html, wishlist_groups)
select s.id, s.school_year,
  make_date(coalesce(substring(s.school_year from '^[0-9]{4}')::int, extract(year from now())::int), 7, 1),
  make_date(coalesce(substring(s.school_year from '^[0-9]{4}')::int, extract(year from now())::int) + 1, 6, 30),
  'active', now(),
  s.logo_url, s.logo_key, s.panel_theme, s.modules, s.phone_display, s.phone_href, s.email, s.office_hours, s.address,
  s.google_calendar_id, s.notice_auto_days, s.calendar_pdf_url, s.calendar_pdf_label,
  s.volunteer_title, s.volunteer_lead, s.volunteer_intro_html, s.staff_title, s.staff_lead, s.staff_intro_html, s.staff_teams,
  s.wishlist_title, s.wishlist_lead, s.wishlist_intro_html, s.wishlist_groups
from schools s
where not exists (select 1 from school_years y where y.school_id = s.id);

-- Content of a year: mark every existing row with its school's active year.
alter table contact_people          add column if not exists year_id integer references school_years(id) on delete cascade;
alter table notices                 add column if not exists year_id integer references school_years(id) on delete cascade;
alter table events                  add column if not exists year_id integer references school_years(id) on delete cascade;
alter table document_categories     add column if not exists year_id integer references school_years(id) on delete cascade;
alter table documents               add column if not exists year_id integer references school_years(id) on delete cascade;
alter table links                   add column if not exists year_id integer references school_years(id) on delete cascade;
alter table pages                   add column if not exists year_id integer references school_years(id) on delete cascade;
alter table volunteer_opportunities add column if not exists year_id integer references school_years(id) on delete cascade;
alter table staff_favorites         add column if not exists year_id integer references school_years(id) on delete cascade;
alter table wishlists               add column if not exists year_id integer references school_years(id) on delete cascade;
alter table family_submissions      add column if not exists year_id integer references school_years(id) on delete cascade;

update contact_people t          set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update notices t                 set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update events t                  set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update document_categories t     set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update documents t               set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update links t                   set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update pages t                   set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update volunteer_opportunities t set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update staff_favorites t         set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update wishlists t               set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;
update family_submissions t      set year_id = y.id from school_years y where y.school_id = t.school_id and y.status = 'active' and t.year_id is null;

alter table contact_people          alter column year_id set not null;
alter table notices                 alter column year_id set not null;
alter table events                  alter column year_id set not null;
alter table document_categories     alter column year_id set not null;
alter table documents               alter column year_id set not null;
alter table links                   alter column year_id set not null;
alter table pages                   alter column year_id set not null;
alter table volunteer_opportunities alter column year_id set not null;
alter table staff_favorites         alter column year_id set not null;
alter table wishlists               alter column year_id set not null;
alter table family_submissions      alter column year_id set not null;

create index if not exists contact_people_year          on contact_people(year_id, sort_order);
create index if not exists notices_year                 on notices(year_id);
create index if not exists events_year                  on events(year_id, event_date);
create index if not exists document_categories_year     on document_categories(year_id, sort_order);
create index if not exists documents_year               on documents(year_id);
create index if not exists links_year                   on links(year_id, placement);
create index if not exists volunteer_opportunities_year on volunteer_opportunities(year_id, sort_order, id);
create index if not exists staff_favorites_year         on staff_favorites(year_id, sort_order, id);
create index if not exists wishlists_year               on wishlists(year_id, sort_order, id);
create index if not exists family_submissions_year      on family_submissions(year_id, date_from desc);

-- Keys and addresses are unique within a year now, not within the school.
alter table document_categories drop constraint if exists document_categories_school_id_key_key;
create unique index if not exists document_categories_year_key on document_categories(year_id, key);
alter table pages drop constraint if exists pages_school_id_slug_key;
create unique index if not exists pages_year_slug on pages(year_id, slug);
drop index if exists pages_legacy;
create unique index if not exists pages_year_legacy on pages(year_id, legacy_path) where legacy_path <> '';

-- Each child's grade this year.
insert into child_years (child_id, year_id, grade, teacher)
select c.id, y.id, c.grade, c.teacher from children c join school_years y on y.school_id = c.school_id and y.status = 'active'
on conflict do nothing;
