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

-- Links: top bar, section menu, mobile menu, "Popular" and the FACTS button.
create table if not exists links (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  placement   text not null check (placement in ('top','sections','menu_sections','menu_more','popular','facts')),
  label       text not null,
  short_label text not null default '',            -- FACTS button: shown on small screens
  href        text not null,
  sort_order  integer not null default 0
);
create index if not exists links_school on links(school_id, placement);
