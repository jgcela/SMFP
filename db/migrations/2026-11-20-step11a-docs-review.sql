-- Step 11a (follow-up): documents copied from last year are marked until the
-- school checks them. NULL = up to date; otherwise the label of the year copied from.
alter table documents add column if not exists review_from text;
