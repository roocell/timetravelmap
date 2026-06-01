create table if not exists timetravelmap.user_tileset_profiles (
  owner_id text primary key,
  initialized_at timestamptz not null default timezone('utc', now())
);

comment on table timetravelmap.user_tileset_profiles is 'Tracks whether a user has had their default tilesets seeded.';
comment on column timetravelmap.user_tileset_profiles.owner_id is 'Stack Auth user id for this tileset initialization record.';

grant select, insert, update, delete on timetravelmap.user_tileset_profiles to authenticated, service_role;
grant select on timetravelmap.user_tileset_profiles to anon;

with owners as (
  select distinct owner_id
  from (
    select owner_id from timetravelmap.events
    union
    select owner_id from timetravelmap.finds
    union
    select owner_id from timetravelmap.prospects
    union
    select owner_id from timetravelmap.images
  ) owner_ids
  where owner_id is not null
),
defaults as (
  select *
  from (
    values
      (0, '1928', 'arcgis', true, 'https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer'),
      (1, '1930s', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1930s'),
      (2, '1945', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1945'),
      (3, '1954', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1954'),
      (4, '1965', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1965'),
      (5, 'hillshade', 'wms', true, 'https://datacube.services.geo.ca/wrapper/ogc/elevation-hrdem-mosaic?service=WMS&layers=dtm-hillshade&format=image/png'),
      (6, 'current', 'arcgis', true, 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer')
  ) as seed(sort_order, name, provider_type, is_visible, url)
)
insert into timetravelmap.user_tileset_profiles (owner_id)
select distinct owner_id
from (
  select owner_id from owners
  union
  select owner_id from timetravelmap.user_tilesets
) seeded_owners
where owner_id is not null
on conflict (owner_id) do nothing;

with owners as (
  select distinct owner_id
  from (
    select owner_id from timetravelmap.events
    union
    select owner_id from timetravelmap.finds
    union
    select owner_id from timetravelmap.prospects
    union
    select owner_id from timetravelmap.images
  ) owner_ids
  where owner_id is not null
),
defaults as (
  select *
  from (
    values
      (0, '1928', 'arcgis', true, 'https://maps.ottawa.ca/arcgis/rest/services/Basemap_Imagery_1928/MapServer'),
      (1, '1930s', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1930s'),
      (2, '1945', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1945'),
      (3, '1954', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1954'),
      (4, '1965', 'xyz', true, 'https://timetravelmap.roocell.com/tiles/1965'),
      (5, 'hillshade', 'wms', true, 'https://datacube.services.geo.ca/wrapper/ogc/elevation-hrdem-mosaic?service=WMS&layers=dtm-hillshade&format=image/png'),
      (6, 'current', 'arcgis', true, 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer')
  ) as seed(sort_order, name, provider_type, is_visible, url)
)
insert into timetravelmap.user_tilesets (
  owner_id,
  name,
  provider_type,
  is_visible,
  url,
  sort_order
)
select
  owners.owner_id,
  defaults.name,
  defaults.provider_type,
  defaults.is_visible,
  defaults.url,
  defaults.sort_order
from owners
cross join defaults
where not exists (
  select 1
  from timetravelmap.user_tilesets existing
  where existing.owner_id = owners.owner_id
);
