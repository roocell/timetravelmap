create extension if not exists postgis with schema extensions;

create type timetravelmap.find_type as enum (
  'coin',
  'ring',
  'jewelry',
  'artifact',
  'other'
);

create type timetravelmap.metal_code as enum (
  'C',
  'S',
  'G'
);

create table timetravelmap.images (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  original_url text,
  mime_type text,
  width integer,
  height integer,
  byte_size bigint,
  alt_text text,
  source_name text,
  checksum_sha256 text,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table timetravelmap.images is 'Locally hosted images referenced by events and finds.';

create table timetravelmap.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  event_date date not null,
  duration_minutes integer,
  device_used text,
  device_mode text,
  description text,
  fill_color text,
  outline_color text,
  outline_width numeric(6, 2),
  area geometry(MultiPolygon, 4326) not null,
  centroid geometry(Point, 4326) generated always as (st_centroid(area)) stored,
  source_file text,
  source_placemark_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint events_duration_minutes_check
    check (duration_minutes is null or duration_minutes > 0),
  constraint events_fill_color_check
    check (fill_color is null or fill_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  constraint events_outline_color_check
    check (outline_color is null or outline_color ~ '^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$'),
  constraint events_outline_width_check
    check (outline_width is null or outline_width >= 0),
  constraint events_area_valid_check
    check (st_isvalid(area)),
  constraint events_source_unique
    unique nulls not distinct (source_file, source_placemark_id)
);

comment on table timetravelmap.events is 'Metal detecting outings represented by polygons on the map.';
comment on column timetravelmap.events.area is 'Event search area geometry in WGS84.';
comment on column timetravelmap.events.centroid is 'Generated centroid used for labels and quick previews.';

create table timetravelmap.event_images (
  event_id uuid not null references timetravelmap.events(id) on delete cascade,
  image_id uuid not null references timetravelmap.images(id) on delete cascade,
  sort_order integer not null default 0,
  caption text,
  primary key (event_id, image_id),
  constraint event_images_sort_order_check check (sort_order >= 0)
);

comment on table timetravelmap.event_images is 'Ordered image attachments for event polygons.';

create table timetravelmap.finds (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references timetravelmap.events(id) on delete set null,
  title text not null,
  find_date date not null,
  age_label text,
  age_start_year integer,
  age_end_year integer,
  type timetravelmap.find_type not null,
  metal timetravelmap.metal_code,
  item_count integer,
  description text,
  location geometry(Point, 4326) not null,
  source_file text,
  source_placemark_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint finds_item_count_check
    check (item_count is null or item_count > 0),
  constraint finds_age_years_check
    check (
      (age_start_year is null and age_end_year is null)
      or (age_start_year is not null and age_end_year is not null and age_start_year <= age_end_year)
    ),
  constraint finds_location_valid_check
    check (st_isvalid(location)),
  constraint finds_source_unique
    unique nulls not distinct (source_file, source_placemark_id)
);

comment on table timetravelmap.finds is 'Individual finds represented by pins on the map.';
comment on column timetravelmap.finds.age_label is 'Human-readable age text such as ''1850s'' or ''Victorian''.';
comment on column timetravelmap.finds.age_start_year is 'Earliest year represented by the find age, if known.';
comment on column timetravelmap.finds.age_end_year is 'Latest year represented by the find age, if known.';

create table timetravelmap.find_images (
  find_id uuid not null references timetravelmap.finds(id) on delete cascade,
  image_id uuid not null references timetravelmap.images(id) on delete cascade,
  sort_order integer not null default 0,
  caption text,
  primary key (find_id, image_id),
  constraint find_images_sort_order_check check (sort_order >= 0)
);

comment on table timetravelmap.find_images is 'Ordered image attachments for map finds.';

create or replace function timetravelmap.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger set_events_updated_at
before update on timetravelmap.events
for each row
execute function timetravelmap.set_updated_at();

create trigger set_finds_updated_at
before update on timetravelmap.finds
for each row
execute function timetravelmap.set_updated_at();

create index events_area_gix on timetravelmap.events using gist (area);
create index events_centroid_gix on timetravelmap.events using gist (centroid);
create index events_event_date_idx on timetravelmap.events (event_date desc);

create index finds_location_gix on timetravelmap.finds using gist (location);
create index finds_find_date_idx on timetravelmap.finds (find_date desc);
create index finds_event_id_idx on timetravelmap.finds (event_id);
create index finds_type_idx on timetravelmap.finds (type);
create index finds_metal_idx on timetravelmap.finds (metal);

create index event_images_sort_idx on timetravelmap.event_images (event_id, sort_order, image_id);
create index find_images_sort_idx on timetravelmap.find_images (find_id, sort_order, image_id);

grant select, insert, update, delete on timetravelmap.images to authenticated, service_role;
grant select, insert, update, delete on timetravelmap.events to authenticated, service_role;
grant select, insert, update, delete on timetravelmap.event_images to authenticated, service_role;
grant select, insert, update, delete on timetravelmap.finds to authenticated, service_role;
grant select, insert, update, delete on timetravelmap.find_images to authenticated, service_role;

grant select on timetravelmap.images to anon;
grant select on timetravelmap.events to anon;
grant select on timetravelmap.event_images to anon;
grant select on timetravelmap.finds to anon;
grant select on timetravelmap.find_images to anon;
