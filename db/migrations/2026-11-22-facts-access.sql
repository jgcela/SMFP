-- FACTS access: which adult (FACTS "Parent Individual ID") may see which student
-- (FACTS "Student ID (System)"), imported from the FACTS CSV, and the verified
-- link between a FACTS parent and a portal account.
-- Only FACTS identifiers are stored: no names, grades or "Family Order".
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
