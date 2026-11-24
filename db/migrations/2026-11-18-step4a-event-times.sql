-- Step 4a, one-off data change (run once, after db/schema.sql).
-- St. Mary is in Colorado.
update schools set timezone = 'America/Denver' where slug = 'stmary';
-- Notes that are just a time ("6:30 pm") or start with one ("6:00 pm, Library")
-- become start_time + the rest of the note. The portal shows exactly the same
-- text, because it rebuilds "6:00 pm, Library" from both fields.
update events
set start_time = to_timestamp(substring(details from '^(\d{1,2}:\d{2} (am|pm))'), 'HH12:MI am')::time,
    details    = coalesce(substring(details from '^\d{1,2}:\d{2} (?:am|pm), (.*)$'), '')
where start_time is null
  and details ~ '^\d{1,2}:\d{2} (am|pm)(, .+)?$';
