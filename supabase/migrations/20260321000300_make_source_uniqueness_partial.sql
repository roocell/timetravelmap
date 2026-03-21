alter table timetravelmap.events
  drop constraint if exists events_source_unique;

create unique index if not exists events_source_unique
  on timetravelmap.events (source_file, source_placemark_id)
  where source_file is not null and source_placemark_id is not null;

alter table timetravelmap.finds
  drop constraint if exists finds_source_unique;

create unique index if not exists finds_source_unique
  on timetravelmap.finds (source_file, source_placemark_id)
  where source_file is not null and source_placemark_id is not null;

alter table timetravelmap.prospects
  drop constraint if exists prospects_source_unique;

create unique index if not exists prospects_source_unique
  on timetravelmap.prospects (source_file, source_placemark_id)
  where source_file is not null and source_placemark_id is not null;
