-- Step 9: emails (Resend), password reset and email change.
-- Where the school gets "new family waiting for approval" emails (set in the staff panel).
alter table schools add column if not exists notify_email text not null default '';

-- One-time links sent by email: reset a password, or confirm a new email.
-- Only a hash of the token is stored. A link works once, for one hour.
create table if not exists email_links (
  id          bigserial primary key,
  token_hash  text not null unique,
  user_id     text not null references auth_user(id) on delete cascade,
  school_id   integer not null references schools(id) on delete cascade,
  purpose     text not null check (purpose in ('reset_password', 'change_email')),
  new_email   text,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists email_links_user on email_links (user_id, purpose);
