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
