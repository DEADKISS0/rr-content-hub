-- Normalización de categorías del Content Hub de RR Aliados
-- MEDIDO 2026-10-02: 28 variantes distintas y 14 ideas sin categoría, sobre 61.
-- Motivo: sin esto no se puede agrupar nada para una gráfica ni para la
-- simulación de desempeño que quiere Santiago.
--
-- Regla de seguridad: este script NO borra nada. Solo:
--   1. escribe el valor canónico en rr_hub_ideas.category
--   2. deja registro de qué cambió, en rr_hub_categoria_migra
-- Para volver atrás: UPDATE ... SET category = (SELECT origen ...) con la tabla
-- de migración, que guarda el valor anterior de cada fila.

begin;

-- 1. Backup del estado actual (para poder revertir fila por fila)
create table if not exists rr_hub_categoria_migra (
  id bigserial primary key,
  idea_id uuid not null references rr_hub_ideas(id) on delete cascade,
  code text not null,
  proyecto text not null,
  categoria_anterior text,
  categoria_nueva text,
  ejecutada_en timestamptz not null default now()
);
create index if not exists rr_hub_categoria_migra_idea on rr_hub_categoria_migra(idea_id);

-- 1b. Registrar QUÉ tenía cada fila antes, para poder revertir. Se inserta
-- desde el snapshot que se tomó justo antes de los updates de abajo.
insert into rr_hub_categoria_migra (idea_id, code, proyecto, categoria_anterior, categoria_nueva)
select i.id, i.code, pr.slug, i.category, v.nueva
from rr_hub_ideas i
join rr_hub_projects pr on pr.id = i.project_id
join (values
    ('Lifestyle clean','LIFESTYLE'),('Lifestyle Clean','LIFESTYLE'),
    ('Lifestyle / Styling / Moda','LIFESTYLE'),('Lookbook · Urbano','LIFESTYLE'),
    ('Marca · Showroom','MARCA'),('Moda / Streetwear / E-commerce','MARCA'),
    ('Aspirational / Lifestyle / Branding','MARCA'),('Lanzamiento · Actitud','MARCA'),
    ('Confianza y oficio','CONFIANZA'),('Prueba social','CONFIANZA'),
    ('Segunda vida y comunidad','CONFIANZA'),
    ('Producto y tela','PRODUCTO'),('Calidad · Premium','PRODUCTO'),
    ('Producto · Colorway','PRODUCTO'),
    ('Conversion','CONVERSION'),('Tienda · Curación','CONVERSION'),
    ('Ajuste y talla','FIT'),('Producto · Fit','FIT'),
    ('Promo & Bundles','PROMO'),('Coleccion y styling','STYLING'),
    ('Pauta: catalogo y color','CATALOGO'),('Humor y memes','HUMOR'),
    ('Sin categoría', null::text),
    ('Comida','COMIDA'),('Restaurante y bebidas','AMBIENTE'),
    ('Hamburguesa y preparación','PRODUCTO')
) as v(anterior, nueva) on v.anterior = i.category
on conflict do nothing;

-- 2. Wundeer: variantes del mismo concepto a un solo valor canónico
update rr_hub_ideas set category = 'LIFESTYLE' where category in
  ('Lifestyle clean','Lifestyle Clean','Lifestyle / Styling / Moda','Lookbook · Urbano');

update rr_hub_ideas set category = 'MARCA' where category in
  ('Marca · Showroom','Moda / Streetwear / E-commerce','Aspirational / Lifestyle / Branding','Lanzamiento · Actitud');

update rr_hub_ideas set category = 'CONFIANZA' where category in
  ('Confianza y oficio','Prueba social','Segunda vida y comunidad');

update rr_hub_ideas set category = 'PRODUCTO' where category in
  ('Producto y tela','Calidad · Premium','Producto · Colorway');

update rr_hub_ideas set category = 'CONVERSION' where category in
  ('Conversion','Tienda · Curación');

update rr_hub_ideas set category = 'FIT' where category in
  ('Ajuste y talla','Producto · Fit');

update rr_hub_ideas set category = 'PROMO'     where category = 'Promo & Bundles';
update rr_hub_ideas set category = 'STYLING'   where category = 'Coleccion y styling';
update rr_hub_ideas set category = 'CATALOGO'  where category = 'Pauta: catalogo y color';
update rr_hub_ideas set category = 'HUMOR'     where category = 'Humor y memes';

-- 3. "Sin categoría" NO es una categoría: es la ausencia de una. Se limpia.
update rr_hub_ideas set category = null where category = 'Sin categoría';

-- 4. Candilejas
update rr_hub_ideas set category = 'COMIDA'   where category = 'Comida';
update rr_hub_ideas set category = 'AMBIENTE' where category = 'Restaurante y bebidas';
update rr_hub_ideas set category = 'PRODUCTO' where category = 'Hamburguesa y preparación';

commit;

-- VERIFICACIÓN (correr después del commit)
-- select category, count(*) from rr_hub_ideas group by category order by 2 desc;
-- select count(*) as sin_categoria from rr_hub_ideas where category is null or btrim(category)='';