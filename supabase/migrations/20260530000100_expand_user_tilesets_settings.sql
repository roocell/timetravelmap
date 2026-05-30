alter table timetravelmap.user_tilesets
  add column if not exists name text,
  add column if not exists provider_type text not null default 'xyz',
  add column if not exists is_visible boolean not null default true;

update timetravelmap.user_tilesets
set provider_type = case
  when lower(url) like '%/mapserver' then 'arcgis'
  when lower(url) like '%service=wms%' or lower(url) like '%layers=%' then 'wms'
  else 'xyz'
end
where provider_type is null or provider_type not in ('xyz', 'arcgis', 'wms');

alter table timetravelmap.user_tilesets
  add constraint user_tilesets_provider_type_check
  check (provider_type in ('xyz', 'arcgis', 'wms'));

comment on column timetravelmap.user_tilesets.name is 'Optional user-defined display name for this tileset.';
comment on column timetravelmap.user_tilesets.provider_type is 'Tileset provider type: xyz, arcgis, or wms.';
comment on column timetravelmap.user_tilesets.is_visible is 'Whether this tileset should appear in the timeline.';
