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
  -- Calendar
  google_calendar_id text not null default '',     -- public Google Calendar id for "Subscribe"
  notice_auto_days  integer not null default 14,   -- automatic "No school" notice: days ahead (0 = off)
  created_at        timestamptz not null default now()
);

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
