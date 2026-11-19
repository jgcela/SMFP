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
--   store_url: optional link to the teacher's list in a store (Amazon...).
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

-- The items of a list. done = "got it": shown crossed out on the portal.
create table if not exists wishlist_items (
  id           serial primary key,
  school_id    integer not null references schools(id) on delete cascade,
  wishlist_id  integer not null references wishlists(id) on delete cascade,
  name         text not null,
  url          text not null default '',
  quantity     integer not null default 1 check (quantity between 1 and 999),
  done         boolean not null default false,
  done_at      timestamptz,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists wishlist_items_list on wishlist_items(wishlist_id, sort_order, id);

-- Groups of the page ([{key, label}]), title, lead and notes, copied from the old page.
alter table schools add column if not exists wishlist_groups jsonb not null default '[]';
alter table schools add column if not exists wishlist_title text not null default '';
alter table schools add column if not exists wishlist_lead text not null default '';
alter table schools add column if not exists wishlist_intro_html text not null default '';
