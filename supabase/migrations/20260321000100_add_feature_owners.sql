alter table timetravelmap.images
  add column owner_id text;

alter table timetravelmap.events
  add column owner_id text;

alter table timetravelmap.finds
  add column owner_id text;

alter table timetravelmap.prospects
  add column owner_id text;

comment on column timetravelmap.images.owner_id is 'Stack Auth user id that owns the uploaded image.';
comment on column timetravelmap.events.owner_id is 'Stack Auth user id that owns the event.';
comment on column timetravelmap.finds.owner_id is 'Stack Auth user id that owns the find.';
comment on column timetravelmap.prospects.owner_id is 'Stack Auth user id that owns the prospect.';

create index images_owner_id_idx on timetravelmap.images (owner_id);
create index events_owner_id_idx on timetravelmap.events (owner_id);
create index finds_owner_id_idx on timetravelmap.finds (owner_id);
create index prospects_owner_id_idx on timetravelmap.prospects (owner_id);
