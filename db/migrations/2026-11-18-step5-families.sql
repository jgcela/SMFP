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
