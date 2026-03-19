create schema if not exists timetravelmap;

comment on schema timetravelmap is 'Application schema for the Time Travel Map app.';

grant usage on schema timetravelmap to anon;
grant usage on schema timetravelmap to authenticated;
grant usage on schema timetravelmap to service_role;
