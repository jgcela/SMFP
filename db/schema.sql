-- Parent portal content, one row set per school.
-- Every table except "schools" has a school_id: a school only ever sees its own rows.
-- Safe to run more than once.

create table if not exists schools (
  id                serial primary key,
  slug              text not null unique,          -- short name used in settings (PORTAL_SCHOOL)
  name              text not null,                 -- full school name
  city              text not null default '',
  region            text not null default '',      -- state
  school_year       text not null,                 -- e.g. 2026–27
  logo_url          text not null default '',
  -- Contact details
  phone_display     text not null default '',      -- as written on the page
  phone_href        text not null default '',      -- tel: link
  email             text not null default '',
  office_hours      text not null default '',
  address           text not null default '',      -- step 4d: street address, linked to the map
  -- Calendar
  google_calendar_id text not null default '',     -- public Google Calendar id for "Subscribe"
  notice_auto_days  integer not null default 14,   -- automatic "No school" notice: days ahead (0 = off)
  created_at        timestamptz not null default now()
);

-- Step 4d: people families can write to, shown under the contact details.
create table if not exists contact_people (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  name        text not null,
  role        text not null default '',
  email       text not null default '',
  sort_order  integer not null default 0
);
create index if not exists contact_people_school on contact_people(school_id, sort_order);

-- The highlighted notice under the header (the "No school" bar).
-- An active notice here is shown instead of the automatic one built from the calendar.
create table if not exists notices (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  message     text not null,
  link_label  text not null default 'See all breaks',
  link_href   text not null default '#calendar',
  is_active   boolean not null default true,
  show_from   date,                                -- empty = from now
  show_until  date,                                -- empty = until switched off
  created_at  timestamptz not null default now()
);
create index if not exists notices_school on notices(school_id);

-- Calendar events. "This week and next", the month view and the automatic notice all read these.
create table if not exists events (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  event_date  date not null,
  end_date    date,                                -- last day off, for multi-day breaks
  category    text not null check (category in ('noclasses','faith','academic','community','health')),
  title       text not null,
  details     text not null default '',
  badges      text[] not null default '{}',        -- e.g. {Health,Important}
  link_url    text not null default '',
  sort_order  integer not null default 0           -- keeps same-day events in order
);
create index if not exists events_school_date on events(school_id, event_date);

-- "Family documents": groups, then the documents in each group.
create table if not exists document_categories (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  key         text not null,                       -- used in links like #cat-health
  name        text not null,
  description text not null default '',
  sort_order  integer not null default 0,
  unique (school_id, key)
);

create table if not exists documents (
  id            serial primary key,
  school_id     integer not null references schools(id) on delete cascade,
  category_id   integer not null references document_categories(id) on delete cascade,
  title         text not null,
  href          text not null,
  meta          text not null default '',          -- e.g. "PDF · 1.8 MB"
  kind          text not null default 'file' check (kind in ('file','web','ext')),
  keywords      text not null default '',          -- extra search words
  added_on      date,                              -- shows a "New" badge for 30 days
  sort_order    integer not null default 0,
  most_used_rank integer                           -- position in "Most used" (empty = not there)
);
create index if not exists documents_school on documents(school_id);

-- Links: main menu ("top": top bar and phone menu), section menu, "Popular" and the FACTS button.
-- "menu_more" is no longer used (step 4c folded it into "top").
create table if not exists links (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  placement   text not null check (placement in ('top','sections','menu_sections','menu_more','popular','facts')),
  label       text not null,
  short_label text not null default '',            -- shorter text: FACTS on small screens, main menu in the top bar
  href        text not null,
  sort_order  integer not null default 0,
  new_tab     boolean not null default false,      -- step 4c: open in a new tab
  hidden      boolean not null default false       -- step 4c: kept, but not shown on the portal
);
create index if not exists links_school on links(school_id, placement);

-- ---------------------------------------------------------------------------
-- Step 3: school staff sign-in (Better Auth) and editing the notice.
-- auth_* tables are Better Auth's own (user, session, account, verification),
-- with snake_case columns. Access to a school's data comes ONLY from
-- school_staff: a signed-in user can edit a school only if listed there.

create table if not exists auth_user (
  id              text primary key,
  name            text not null,
  email           text not null unique,
  email_verified  boolean not null default false,
  image           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists auth_session (
  id          text primary key,
  expires_at  timestamptz not null,
  token       text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  ip_address  text,
  user_agent  text,
  user_id     text not null references auth_user(id) on delete cascade
);
create index if not exists auth_session_user on auth_session(user_id);

create table if not exists auth_account (
  id                        text primary key,
  account_id                text not null,
  provider_id               text not null,
  user_id                   text not null references auth_user(id) on delete cascade,
  access_token              text,
  refresh_token             text,
  id_token                  text,
  access_token_expires_at   timestamptz,
  refresh_token_expires_at  timestamptz,
  scope                     text,
  password                  text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists auth_account_user on auth_account(user_id);

create table if not exists auth_verification (
  id          text primary key,
  identifier  text not null,
  value       text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists auth_verification_identifier on auth_verification(identifier);

-- Which school(s) each staff user may edit.
create table if not exists school_staff (
  user_id     text not null references auth_user(id) on delete cascade,
  school_id   int  not null references schools(id) on delete cascade,
  role        text not null default 'admin',
  created_at  timestamptz not null default now(),
  primary key (user_id, school_id)
);

-- One-time links to choose a password (only a SHA-256 hash of the token is
-- stored). Used once, then expire. Created by scripts/staff-link.mjs.
create table if not exists staff_setup_links (
  token_hash  text primary key,
  user_id     text not null references auth_user(id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Failed sign-in counter (slows down password guessing).
create table if not exists login_attempts (
  key           text primary key,
  failures      int not null default 0,
  window_start  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Step 4a: the calendar is managed from the staff area.
-- start_time: null = all day. Shown on the portal as "6:30 pm" before the note.
alter table events add column if not exists start_time time;
-- The school's time zone, used to read times from imported .ics files.
alter table schools add column if not exists timezone text not null default 'UTC';

-- ---------------------------------------------------------------------------
-- Step 4b: documents managed from the staff area.
-- An uploaded file lives in Cloudflare R2 (file_key); the portal links to
-- /doc/<id>, which redirects to a short-lived signed link.
alter table documents add column if not exists description  text not null default '';
alter table documents add column if not exists file_key     text;
alter table documents add column if not exists file_name    text;
alter table documents add column if not exists content_type text;
alter table documents add column if not exists file_size    bigint;

-- Step 4e: text pages edited from the staff area (Handbook, Supply list...).
-- Each page has a draft and a published copy; families only see the published one.
-- Every save and every publish is kept in page_versions, so any of them can be restored.
create table if not exists pages (
  id              serial primary key,
  school_id       integer not null references schools(id) on delete cascade,
  slug            text not null,                    -- address: /pages/<slug>
  legacy_path     text not null default '',         -- old address that must keep working, e.g. supply-list_202627.html
  draft_title     text not null,
  draft_summary   text not null default '',
  draft_html      text not null default '',
  title           text not null default '',         -- published copy
  summary         text not null default '',
  html            text not null default '',
  published_at    timestamptz,
  updated_at      timestamptz not null default now(),
  unique (school_id, slug)
);
create unique index if not exists pages_legacy on pages(school_id, legacy_path) where legacy_path <> '';

create table if not exists page_versions (
  id          serial primary key,
  page_id     integer not null references pages(id) on delete cascade,
  kind        text not null check (kind in ('draft', 'published', 'imported', 'restored')),
  title       text not null,
  summary     text not null default '',
  html        text not null,
  author      text not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists page_versions_page on page_versions(page_id, created_at desc);

-- Old addresses that now lead somewhere other than a page, e.g. the old Supply list
-- page, which became its PDF. Checked after pages.legacy_path.
create table if not exists redirects (
  id         serial primary key,
  school_id  integer not null references schools(id) on delete cascade,
  path       text not null,            -- e.g. supply-list_202627.html
  target     text not null,            -- portal file (assets/...) or https:// address
  unique (school_id, path)
);

-- Step 5: families sign in to the portal once the school approves them.
-- A family registers with the school's code (schools.family_code), which the
-- school hands out and can change; the old code then stops working.
alter table schools add column if not exists family_code text;
update schools set family_code = upper(substr(md5(random()::text || id::text), 1, 4) || '-' || substr(md5(random()::text || slug), 1, 4))
  where family_code is null;

-- One family account per sign-in (auth_user), and it belongs to one school only.
-- status: pending (waiting for the school) | approved | rejected | disabled.
-- sso_provider / sso_subject: for signing in later through FACTS (or another
-- SSO); empty while families use email and password.
create table if not exists families (
  id            serial primary key,
  school_id     integer not null references schools(id) on delete cascade,
  user_id       text not null unique references auth_user(id) on delete cascade,
  name          text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'disabled')),
  sso_provider  text,
  sso_subject   text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    text not null default ''
);
create index if not exists families_school on families(school_id, status, created_at desc);
create unique index if not exists families_sso on families(school_id, sso_provider, sso_subject) where sso_provider is not null;

-- Step 6a: "My family" for approved families.
-- Family details: parents' names, phone, and an optional second adult to contact.
alter table families add column if not exists parent_names    text not null default '';
alter table families add column if not exists phone           text not null default '';
alter table families add column if not exists contact2_name   text not null default '';
alter table families add column if not exists contact2_phone  text not null default '';
alter table families add column if not exists contact2_relation text not null default '';

-- Children: added by the family, the school can correct them. Later they may
-- come from FACTS (facts_id), but for now they are typed in.
create table if not exists children (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  family_id   integer not null references families(id) on delete cascade,
  name        text not null,
  grade       text not null default '',
  teacher     text not null default '',
  facts_id    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default ''
);
create index if not exists children_family on children(family_id, id);

-- What families send to the school: absences and requests, in one list.
--   kind = 'absence': child_id required, date_from..date_to, category = sick | medical | family | other
--   kind = 'request': child_id optional, date_from = the day it is for, category = early_pickup | transportation | meeting | other
-- status: received -> in_progress -> resolved, changed by the school.
create table if not exists family_submissions (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  family_id   integer not null references families(id) on delete cascade,
  child_id    integer references children(id) on delete set null,
  child_name  text not null default '',      -- kept even if the child is removed later
  kind        text not null check (kind in ('absence', 'request')),
  category    text not null,
  date_from   date not null,
  date_to     date not null,
  message     text not null default '',
  status      text not null default 'received' check (status in ('received', 'in_progress', 'resolved')),
  created_at  timestamptz not null default now(),
  status_at   timestamptz,
  status_by   text not null default '',
  check (date_to >= date_from)
);
create index if not exists family_submissions_school on family_submissions(school_id, date_from desc);
create index if not exists family_submissions_family on family_submissions(family_id, created_at desc);
-- Step 6b: the Volunteer page becomes data.
-- One row per opportunity. Shown on /volunteer unless hidden.
--   kind: classroom | faith | events (the filter chips on the page)
--   event_date/start_time/end_time: for a one-time opportunity; when_text for
--   recurring ones ("Tuesdays · Weekly"), shown when there is no date.
--   spots: how many families can sign up; null = no limit.
--   portal_signup: families sign up on the portal. Off for the imported ones,
--   which keep their own sign-up (SignUpGenius, a form, email) as before.
--   details: one item per line; **text** is shown in bold.
--   links: the buttons, [{label, href}]; the first is the main one.
create table if not exists volunteer_opportunities (
  id             serial primary key,
  school_id      integer not null references schools(id) on delete cascade,
  kind           text not null default 'events' check (kind in ('classroom', 'faith', 'events')),
  title          text not null,
  organizer      text not null default '',
  area           text not null default '',
  description    text not null default '',
  location       text not null default '',
  event_date     date,
  start_time     time,
  end_time       time,
  when_text      text not null default '',
  who_text       text not null default '',
  spots          integer check (spots is null or spots between 1 and 1000),
  contact_name   text not null default '',
  contact_email  text not null default '',
  contact_phone  text not null default '',
  details_title  text not null default 'Details',
  details        text not null default '',
  links          jsonb not null default '[]',
  flyer          text not null default '',
  portal_signup  boolean not null default true,
  hidden         boolean not null default false,
  sort_order     integer not null default 0,
  imported       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default ''
);
create index if not exists volunteer_opportunities_school on volunteer_opportunities(school_id, sort_order, id);

-- Families who signed up. One sign-up per family and opportunity.
create table if not exists volunteer_signups (
  id              serial primary key,
  school_id       integer not null references schools(id) on delete cascade,
  opportunity_id  integer not null references volunteer_opportunities(id) on delete cascade,
  family_id       integer not null references families(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (opportunity_id, family_id)
);
create index if not exists volunteer_signups_family on volunteer_signups(family_id);

-- The fixed part at the top of the page ("Three steps for every volunteer"),
-- copied from the old page. Empty for a school that has none.
alter table schools add column if not exists volunteer_intro_html text not null default '';
alter table schools add column if not exists volunteer_lead text not null default '';
alter table schools add column if not exists volunteer_title text not null default '';

-- Step 6c: the Staff favorites page becomes data. Only families who signed in see it.
-- One row per staff member (a "card").
--   team: key of one of the school's teams (schools.staff_teams); '' = no team.
--   photo_key: optional photo in private storage (staff/<school>/<uuid>/<name>).
--   favorites: [{label, value}] in the order shown; the first 4 are always
--   visible, the rest go under "More favorites". An empty list = "still to share".
--   wishlist_href: optional "Classroom wishlist" button.
-- There are no birthday or allergy columns on purpose: they are not published.
create table if not exists staff_favorites (
  id             serial primary key,
  school_id      integer not null references schools(id) on delete cascade,
  team           text not null default '',
  name           text not null,
  role           text not null default '',
  photo_key      text,
  favorites      jsonb not null default '[]',
  wishlist_href  text not null default '',
  hidden         boolean not null default false,
  sort_order     integer not null default 0,
  imported       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  updated_by     text not null default ''
);
create index if not exists staff_favorites_school on staff_favorites(school_id, sort_order, id);

-- The groups of the page ([{key, label}], in order), the title, lead and the
-- notes at the top, copied from the old page. Empty for a school that has none.
alter table schools add column if not exists staff_teams jsonb not null default '[]';
alter table schools add column if not exists staff_title text not null default '';
alter table schools add column if not exists staff_lead text not null default '';
alter table schools add column if not exists staff_intro_html text not null default '';

-- Step 6d: the Teacher wishlists page becomes data. Only families who signed in see it.
-- One row per teacher's list.
--   staff_id: the teacher's card in Staff favorites; their name comes from there, so it
--   is written once. `name` is a copy kept for a list with no card (or if the card is deleted).
--   class_text: what the list is for ("2nd Grade — 2A"), which can differ from the card's role.
--   grp: key of one of the school's wishlist groups (schools.wishlist_groups).
--   store_url: link to the teacher's list in a store (Amazon...), where the items live.
create table if not exists wishlists (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  staff_id    integer references staff_favorites(id) on delete set null,
  name        text not null default '',
  class_text  text not null default '',
  grp         text not null default '',
  store_url   text not null default '',
  hidden      boolean not null default false,
  sort_order  integer not null default 0,
  imported    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default ''
);
create index if not exists wishlists_school on wishlists(school_id, sort_order, id);

-- Groups of the page ([{key, label}]), title, lead and notes, copied from the old page.
alter table schools add column if not exists wishlist_groups jsonb not null default '[]';
alter table schools add column if not exists wishlist_title text not null default '';
alter table schools add column if not exists wishlist_lead text not null default '';
alter table schools add column if not exists wishlist_intro_html text not null default '';

-- Step 7: look of the private panels (colours, short name, emblem), per school.
alter table schools add column if not exists panel_theme jsonb not null default '{}'::jsonb;
-- Where the school gets "new family waiting for approval" emails (set in the staff panel).
alter table schools add column if not exists notify_email text not null default '';

-- One-time links sent by email: reset a password, or confirm a new email.
-- Only a hash of the token is stored. A link works once, for one hour.
create table if not exists email_links (
  id          bigserial primary key,
  token_hash  text not null unique,
  user_id     text not null references auth_user(id) on delete cascade,
  school_id   integer not null references schools(id) on delete cascade,
  purpose     text not null check (purpose in ('reset_password', 'change_email')),
  new_email   text,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists email_links_user on email_links (user_id, purpose);

-- Step 10: the FAMITENLY panel (/platform), where FAMITENLY creates and manages schools.
-- Safe to run more than once.

-- Plan, state and modules of each school.
-- plan: essential | smart | autonomous (names and prices are in lib/plans.ts).
-- status: active | trial | suspended (suspended: nobody of the school can sign in,
-- and the portal shows a notice instead of its pages).
-- modules: the optional parts the school has turned on (lib/plans.ts).
alter table schools add column if not exists plan text not null default 'essential'
  check (plan in ('essential', 'smart', 'autonomous'));
alter table schools add column if not exists status text not null default 'active'
  check (status in ('active', 'trial', 'suspended'));
alter table schools add column if not exists modules text[] not null default '{families,requests}';
-- The full calendar as a PDF (was fixed in the page until step 10). Empty: no link.
alter table schools add column if not exists calendar_pdf_url text not null default '';
alter table schools add column if not exists calendar_pdf_label text not null default '';
-- The logo uploaded from /platform (private storage key), served at /s/<code>/logo.
alter table schools add column if not exists logo_key text not null default '';
-- Support: until when the school lets FAMITENLY into its staff panel (null: not allowed).
alter table schools add column if not exists support_until timestamptz;
alter table schools add column if not exists support_granted_by text references auth_user(id) on delete set null;

-- St. Mary (the school that existed before step 10) keeps everything it had.
update schools set modules = '{families,requests,volunteer,staff_favorites,wishlists}',
  calendar_pdf_url = 'assets/documents/Calendar_2026-27.pdf', calendar_pdf_label = 'Full calendar (PDF, 2.4 MB)'
  where slug = 'stmary' and calendar_pdf_url = '';

-- FAMITENLY's own people. The second step of sign-in (an authenticator app code)
-- is mandatory: totp_secret is encrypted with BETTER_AUTH_SECRET, and backup
-- codes are stored only as hashes (each one works once).
create table if not exists platform_admins (
  user_id       text primary key references auth_user(id) on delete cascade,
  totp_secret   text,                    -- encrypted, null until set up
  totp_enabled_at timestamptz,
  totp_last_step bigint not null default 0, -- a code is accepted only once
  backup_codes  text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- Sessions that passed the second step (a Better Auth session id per row).
create table if not exists platform_sessions (
  session_id  text primary key,
  user_id     text not null references auth_user(id) on delete cascade,
  verified_at timestamptz not null default now()
);

-- Support visits: a FAMITENLY person inside a school's staff panel, only while
-- the school allows it (schools.support_until) and until expires_at.
create table if not exists platform_support (
  session_id  text primary key,
  user_id     text not null references auth_user(id) on delete cascade,
  school_id   integer not null references schools(id) on delete cascade,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

-- Everything FAMITENLY people do: who, what, in which school and when.
create table if not exists platform_audit (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  user_id     text references auth_user(id) on delete set null,
  user_email  text not null default '',
  action      text not null,
  school_id   integer references schools(id) on delete set null,
  detail      text not null default '',
  ip          text not null default ''
);
create index if not exists platform_audit_at on platform_audit (at desc);
create index if not exists platform_audit_school on platform_audit (school_id, at desc);

-- ---------------------------------------------------------------------------
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

-- Step 11a follow-up: copied documents waiting to be checked.
alter table documents add column if not exists review_from text;

-- ---------------------------------------------------------------------------
-- FACTS access import and verified parent accounts (db/migrations/2026-11-22-facts-access.sql).
-- Additive only (new tables, one partial unique index): safe to run more than once
-- and safe for the live portal, which keeps working while it runs.

-- One row per import (access file or emails file): counts only, never names.
create table if not exists facts_imports (
  id           bigserial primary key,
  school_id    integer not null references schools(id) on delete cascade,
  kind         text not null check (kind in ('access', 'emails')),
  file_sha256  text not null,
  summary      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  created_by   text not null default ''
);
create index if not exists facts_imports_school on facts_imports(school_id, created_at desc);

-- The FACTS permission of one adult for one student, within one school.
--   granted:  "Has access to Parents Web" = Yes
--   denied:   = No (also revokes an earlier Yes)
--   conflict: the same file said Yes and No; no access until a later file is consistent.
-- A link missing from a later file is left as it is (FACTS reports can be partial).
create table if not exists facts_student_access (
  school_id         integer not null references schools(id) on delete cascade,
  parent_facts_id   text not null,
  student_facts_id  text not null,
  state             text not null check (state in ('granted', 'denied', 'conflict')),
  changed_at        timestamptz not null default now(),
  import_id         bigint references facts_imports(id) on delete set null,
  primary key (school_id, parent_facts_id, student_facts_id)
);
create index if not exists facts_student_access_student on facts_student_access(school_id, student_facts_id);

-- FACTS families and their students (a student can be in two families).
-- Family ID only groups; it never grants access.
create table if not exists facts_family_students (
  school_id         integer not null references schools(id) on delete cascade,
  family_facts_id   text not null,
  student_facts_id  text not null,
  first_seen_at     timestamptz not null default now(),
  primary key (school_id, family_facts_id, student_facts_id)
);

-- Each FACTS parent of the school, its email (typed by the school or imported)
-- and, once verified, the portal account. The association counts only when
-- user_id is set, which happens only through an invitation link (verified_at says when).
-- If the account is deleted, user_id becomes empty and the parent can be invited again.
create table if not exists facts_parents (
  school_id        integer not null references schools(id) on delete cascade,
  parent_facts_id  text not null,
  email            text,
  user_id          text references auth_user(id) on delete set null,
  verified_at      timestamptz,
  verified_via     text check (verified_via in ('new_account', 'existing_account')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (school_id, parent_facts_id)
);
-- An account is linked to at most one FACTS parent per school.
create unique index if not exists facts_parents_user on facts_parents(school_id, user_id) where user_id is not null;

-- Invitations: a one-time link (only its SHA-256 hash is stored) that works for
-- 7 days. Sending a new one cancels the previous one.
create table if not exists facts_invitations (
  id               bigserial primary key,
  school_id        integer not null references schools(id) on delete cascade,
  parent_facts_id  text not null,
  email            text not null,
  token_hash       text not null unique,
  mode             text not null check (mode in ('new_account', 'existing_account')),
  source           text not null check (source in ('panel', 'csv')),
  expires_at       timestamptz not null,
  used_at          timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  created_by       text not null default '',
  foreign key (school_id, parent_facts_id) references facts_parents(school_id, parent_facts_id) on delete cascade
);
create index if not exists facts_invitations_parent on facts_invitations(school_id, parent_facts_id, created_at desc);

-- A child of the portal is matched to FACTS by children.facts_id (once per school).
create unique index if not exists children_facts_id on children(school_id, facts_id) where facts_id is not null;
