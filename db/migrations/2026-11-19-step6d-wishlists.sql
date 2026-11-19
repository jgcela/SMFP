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
