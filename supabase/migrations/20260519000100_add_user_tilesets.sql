create table timetravelmap.user_tilesets (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_tilesets_url_not_blank_check
    check (length(btrim(url)) > 0),
  constraint user_tilesets_sort_order_check
    check (sort_order >= 0)
);

comment on table timetravelmap.user_tilesets is 'Per-user custom tileset URLs shown in the settings panel.';
comment on column timetravelmap.user_tilesets.owner_id is 'Stack Auth user id that owns this tileset URL.';

create trigger set_user_tilesets_updated_at
before update on timetravelmap.user_tilesets
for each row
execute function timetravelmap.set_updated_at();

create index user_tilesets_owner_sort_idx
  on timetravelmap.user_tilesets (owner_id, sort_order, created_at);

grant select, insert, update, delete on timetravelmap.user_tilesets to authenticated, service_role;
grant select on timetravelmap.user_tilesets to anon;
