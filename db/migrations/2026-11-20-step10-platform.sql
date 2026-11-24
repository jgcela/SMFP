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
