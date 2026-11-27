-- Datos sinteticos para el E2E local. No son filas de produccion.
insert into public.rr_hub_projects (id, name, slug, client_name, brand_primary_color, description)
values (
  '11111111-1111-4111-8111-111111111111',
  'Wundeer',
  'wundeer',
  'Wundeer',
  '#111111',
  'Cliente local de prueba. No es el de produccion.'
)
on conflict (slug) do nothing;
