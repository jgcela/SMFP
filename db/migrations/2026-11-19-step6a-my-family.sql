-- Step 6a: "My family" for approved families.
-- Family details: parents' names, phone, and an optional second adult to contact.
alter table families add column if not exists parent_names    text not null default '';
alter table families add column if not exists phone           text not null default '';
alter table families add column if not exists contact2_name   text not null default '';
alter table families add column if not exists contact2_phone  text not null default '';
alter table families add column if not exists contact2_relation text not null default '';

-- Children: added by the family, the school can correct them. Later they may
-- come from FACTS (facts_id), but for now they are typed in.
create table if not exists children (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  family_id   integer not null references families(id) on delete cascade,
  name        text not null,
  grade       text not null default '',
  teacher     text not null default '',
  facts_id    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  text not null default ''
);
create index if not exists children_family on children(family_id, id);

-- What families send to the school: absences and requests, in one list.
--   kind = 'absence': child_id required, date_from..date_to, category = sick | medical | family | other
--   kind = 'request': child_id optional, date_from = the day it is for, category = early_pickup | transportation | meeting | other
-- status: received -> in_progress -> resolved, changed by the school.
create table if not exists family_submissions (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  family_id   integer not null references families(id) on delete cascade,
  child_id    integer references children(id) on delete set null,
  child_name  text not null default '',      -- kept even if the child is removed later
  kind        text not null check (kind in ('absence', 'request')),
  category    text not null,
  date_from   date not null,
  date_to     date not null,
  message     text not null default '',
  status      text not null default 'received' check (status in ('received', 'in_progress', 'resolved')),
  created_at  timestamptz not null default now(),
  status_at   timestamptz,
  status_by   text not null default '',
  check (date_to >= date_from)
);
create index if not exists family_submissions_school on family_submissions(school_id, date_from desc);
create index if not exists family_submissions_family on family_submissions(family_id, created_at desc);
