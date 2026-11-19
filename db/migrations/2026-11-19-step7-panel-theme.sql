-- Step 7: look of the private panels, per school (colours, short name, emblem).
alter table schools add column if not exists panel_theme jsonb not null default '{}'::jsonb;
