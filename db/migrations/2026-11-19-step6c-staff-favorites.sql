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
