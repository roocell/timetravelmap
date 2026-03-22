alter table timetravelmap.events
  add column if not exists area_m2 double precision;

create or replace function timetravelmap.set_event_area_m2()
returns trigger
language plpgsql
as $$
begin
  new.area_m2 := ST_Area(new.area::geography);
  return new;
end;
$$;

drop trigger if exists events_set_area_m2 on timetravelmap.events;

create trigger events_set_area_m2
before insert or update of area
on timetravelmap.events
for each row
execute function timetravelmap.set_event_area_m2();

update timetravelmap.events
set area_m2 = ST_Area(area::geography)
where area_m2 is null;
