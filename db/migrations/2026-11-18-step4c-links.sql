-- Step 4c: links edited from the staff area.
-- new_tab: open in a new tab. hidden: kept but not shown on the portal.
-- The main menu becomes one list ("top"): label is the full text (phone menu),
-- short_label the shorter text for the top bar. The old "menu_more" rows, which
-- repeated the same links with the full text, are folded into it.
alter table links add column if not exists new_tab boolean not null default false;
alter table links add column if not exists hidden boolean not null default false;

update links t set short_label = case when m.label <> t.label then t.label else '' end, label = m.label
from links m
where t.placement = 'top' and m.placement = 'menu_more' and m.school_id = t.school_id and m.href = t.href;
delete from links m where m.placement = 'menu_more'
  and exists (select 1 from links t where t.placement = 'top' and t.school_id = m.school_id and t.href = m.href);

-- Same rule the portal already followed: files and other websites in a new tab.
update links set new_tab = true
where placement = 'facts' or href ~* '^https?://' or (href !~ '^(#|mailto:|tel:)' and href !~ '_202627\.html$' and href <> '');
