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
