-- FACTS families and students (provisional, until there is a direct FACTS connection).
-- The school can create its families and their children from the FACTS report:
-- a family may now exist without an account, and a family may have several
-- accounts (each parent signs in with their own email).
-- Safe to run more than once. The portal keeps working while it runs; run the
-- "family_users" copy again after deploying (it only adds missing rows).

-- A family created by the school from FACTS has no account of its own.
alter table families alter column user_id drop not null;
alter table families add column if not exists facts_family_id text;
create unique index if not exists families_facts on families(school_id, facts_family_id) where facts_family_id is not null;

-- The accounts that sign in as a family (one family per account and school).
create table if not exists family_users (
  family_id   integer not null references families(id) on delete cascade,
  user_id     text not null references auth_user(id) on delete cascade,
  school_id   integer not null references schools(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (family_id, user_id)
);
create unique index if not exists family_users_one on family_users(school_id, user_id);
insert into family_users (family_id, user_id, school_id)
select id, user_id, school_id from families where user_id is not null
on conflict do nothing;

-- Which FACTS parents belong to which FACTS family (ids only): an invited parent
-- joins their FACTS family when they accept the invitation.
create table if not exists facts_family_parents (
  school_id         integer not null references schools(id) on delete cascade,
  family_facts_id   text not null,
  parent_facts_id   text not null,
  first_seen_at     timestamptz not null default now(),
  primary key (school_id, family_facts_id, parent_facts_id)
);
create index if not exists facts_family_parents_parent on facts_family_parents(school_id, parent_facts_id);

-- How each FACTS "Grade Level" code reads in the portal (e.g. {"01": "1st grade"}).
alter table schools add column if not exists facts_grade_map jsonb not null default '{}'::jsonb;

-- Imports of families and students are recorded like the other FACTS imports.
alter table facts_imports drop constraint if exists facts_imports_kind_check;
alter table facts_imports add constraint facts_imports_kind_check check (kind in ('access', 'emails', 'families'));
