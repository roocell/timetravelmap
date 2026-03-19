alter table timetravelmap.finds
  add column latitude double precision,
  add column longitude double precision;

update timetravelmap.finds
set
  latitude = extensions.st_y(location),
  longitude = extensions.st_x(location)
where location is not null;

drop index if exists timetravelmap.finds_location_gix;

alter table timetravelmap.finds
  drop constraint if exists finds_location_valid_check,
  add constraint finds_latitude_check check (latitude between -90 and 90),
  add constraint finds_longitude_check check (longitude between -180 and 180);

alter table timetravelmap.finds
  alter column latitude set not null,
  alter column longitude set not null;

alter table timetravelmap.finds
  drop column location;

create index finds_latitude_idx on timetravelmap.finds (latitude);
create index finds_longitude_idx on timetravelmap.finds (longitude);

create table timetravelmap.prospects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  age_label text,
  age_start_year integer,
  age_end_year integer,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  date_visited date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint prospects_latitude_check check (latitude between -90 and 90),
  constraint prospects_longitude_check check (longitude between -180 and 180),
  constraint prospects_age_years_check check (
    (age_start_year is null and age_end_year is null)
    or (age_start_year is not null and age_end_year is not null and age_start_year <= age_end_year)
  )
);

comment on table timetravelmap.prospects is 'Prospective detecting sites stored as map pins.';
comment on column timetravelmap.prospects.age_label is 'Human-readable age text such as ''1879'' or ''1850-1860''.';
comment on column timetravelmap.prospects.age_start_year is 'Earliest year represented by the prospect age, if known.';
comment on column timetravelmap.prospects.age_end_year is 'Latest year represented by the prospect age, if known.';
comment on column timetravelmap.prospects.date_visited is 'Most recent date the prospect was visited.';

create table timetravelmap.prospect_images (
  prospect_id uuid not null references timetravelmap.prospects(id) on delete cascade,
  image_id uuid not null references timetravelmap.images(id) on delete cascade,
  sort_order integer not null default 0,
  caption text,
  primary key (prospect_id, image_id),
  constraint prospect_images_sort_order_check check (sort_order >= 0)
);

comment on table timetravelmap.prospect_images is 'Ordered image attachments for prospects.';

create trigger set_prospects_updated_at
before update on timetravelmap.prospects
for each row
execute function timetravelmap.set_updated_at();

create index prospects_date_visited_idx on timetravelmap.prospects (date_visited desc);
create index prospects_latitude_idx on timetravelmap.prospects (latitude);
create index prospects_longitude_idx on timetravelmap.prospects (longitude);
create index prospect_images_sort_idx on timetravelmap.prospect_images (prospect_id, sort_order, image_id);

grant select, insert, update, delete on timetravelmap.prospects to authenticated, service_role;
grant select, insert, update, delete on timetravelmap.prospect_images to authenticated, service_role;
grant select on timetravelmap.prospects to anon;
grant select on timetravelmap.prospect_images to anon;
