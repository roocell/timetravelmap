alter table timetravelmap.prospects
  add column if not exists marker_color text;

update timetravelmap.prospects
set marker_color = '#f0c419'
where marker_color is null;

alter table timetravelmap.prospects
  alter column marker_color set default '#f0c419';

comment on column timetravelmap.prospects.marker_color is 'Hex color used for the prospect pin fill on the map.';
