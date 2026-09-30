# ✅ RESUELTO: el CRM ya no es legible ni escribible sin sesion (2026-09-30)

> **Estado: cerrado y medido.** Migracion `20260930_crm_anon_lockdown.sql` aplicada.
> Las cinco tablas dan `permission denied` con la anon key. **Cero filas borradas**
> (prospects 22, activities 2, knowledge 21, sequences 63, demos 17, ideas_hub 56 —
> los mismos numeros que antes). `verticals` se deja publica a proposito: son
> nombres de sector, no datos de contacto, y hay codigo que la lee.
>
> El historico de como se encontre, para que no se repita:

# FUGA REAL: el CRM era legible y ESCRIBIBLE sin sesion (2026-09-30)

## QUE SE HA MEDIDO (con la publishable key, la que va en el bundle del navegador)

```
TABLA                 FILAS LEGIBLES SIN SESION
prospects                      22      ← 29 columnas: teléfono, WhatsApp, correo, dirección
outreach_sequences            63      ← secuencias de contacto comercial
knowledge                      21      ← "Servicios y precios", entre otros
demos                          17
activities                      2
verticals                       2
```

Y no solo lectura: `activities`, `demos`, `knowledge`, `outreach_sequences` y
`prospects` tienen policy `cmd = ALL` con `qual = true` para el rol `anon`, más
`GRANT ... TO anon` completo. O sea: **cualquiera que abra la página puede
escribir en el CRM**, no solo leerlo.

## POR QUE NO SE HABIA VISTO

`scripts/verify-leak.mjs` existe y detecta esto, pero:

1. **NO está en `npm run verify`** (que es lo que corre CI). Nunca ha corrido
   automáticamente: hay que acordarse de invocarlo a mano.
2. Mira `profiles` y `projects` en `MUST_BE_PRIVATE`, pero las tablas del CRM se
   llaman `prospects`, `activities`, `knowledge`, `outreach_sequences`, `demos`.
   Al preguntar por nombres que no existen, el check da "ok" sin haber medido
   nada. Un verificador que mira las tablas equivocadas es peor que no tener
   ninguno: da una confianza falsa.
3. Su salida es contradictoria: avisa "AVISO rr_hub_ideas — sin permiso. Wundeer
   tiene que ser legible sin sesion" y a la vez termina en `TODO OK`.

## LO QUE ESTA BIEN

El hub SI esta cerrado. Medido con la misma key anonima:

```
rr_hub_ideas / comments / events / assets / projects  → permission denied
```

Las policies `rr_hub_wundeer_public_*` existen pero al rol `anon` le falta el
`GRANT`, asi que la puerta aguanta. Ese camino se puede dejar quieto.

## LO QUE SE HIZO

1. ✅ Migracion `20260930_crm_anon_lockdown.sql`: quita los policies `*_all_anon` /
   `*_write_anon` / `"Allow all operations"` y revoca el `GRANT` al rol `anon` en las
   cinco. **No borra ni una fila**; revertir es volver a dar los grants.
2. ✅ `verify-leak.mjs` arreglado: mira las tablas que existen de verdad y el
   sentido de `readable()` esta correcto (se dio la vuelta una vez y reportaba
   FUGA donde no habia ninguna). `unknown > 0` sale con 2, porque un "todo bien"
   sin comprobar es peor que un fallo.
3. ❌ **NO** se metio en `npm run verify`, a proposito: ese pipeline corre SIN RED en
   CI y el verificador necesita llamar a Supabase. Lo documenta el propio
   `package.json`. Se invoca a mano antes de tocar permisos.
4. ✅ Probado en rojo de verdad: se dio `GRANT SELECT ON prospects TO anon`, el
   verificador reporto `FUGA prospects — legible sin sesion (200)` y salio con
   `exit 1`. Luego se revIRTIO. Un verificador que no ha visto una fuga real
  probado una vez no sirve.
