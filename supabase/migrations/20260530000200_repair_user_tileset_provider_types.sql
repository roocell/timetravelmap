update timetravelmap.user_tilesets
set provider_type = case
  when lower(url) like '%/mapserver' then 'arcgis'
  when lower(url) like '%service=wms%' or lower(url) like '%layers=%' then 'wms'
  else 'xyz'
end
where provider_type = 'xyz'
  and (
    lower(url) like '%/mapserver'
    or lower(url) like '%service=wms%'
    or lower(url) like '%layers=%'
  );
