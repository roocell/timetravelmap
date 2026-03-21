alter table timetravelmap.prospects
  add column source_file text,
  add column source_placemark_id text;

alter table timetravelmap.prospects
  add constraint prospects_source_unique
    unique nulls not distinct (source_file, source_placemark_id);

comment on column timetravelmap.prospects.source_file is 'Source KML filename used for idempotent prospect imports.';
comment on column timetravelmap.prospects.source_placemark_id is 'Source KML placemark id used for idempotent prospect imports.';
