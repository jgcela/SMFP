-- Step 4d: contact details edited from the staff area.
-- The school's street address (shown with a link to the map) and, optionally,
-- people families can write to, in the order the school chooses.
alter table schools add column if not exists address text not null default '';

create table if not exists contact_people (
  id          serial primary key,
  school_id   integer not null references schools(id) on delete cascade,
  name        text not null,
  role        text not null default '',
  email       text not null default '',
  sort_order  integer not null default 0
);
create index if not exists contact_people_school on contact_people(school_id, sort_order);
