-- ===========================================================================
-- 20260930_crm_anon_lockdown.sql
--
-- Por que este archivo existe
-- ------------------------
-- El 2026-09-30, al auditar de nuevo el hub, se measo con la publishable key
-- (la que va en el bundle del navegador, o sea la que tiene cualquier visitante)
-- y se encontro que el CRM heredado de este proyecto de Supabase seguia
-- ABIERTO al rol `anon`, en lectura Y en escritura:
--
--   tabla                 filas legibles sin sesion
--   prospects                        22   (29 columnas: telefono, whatsapp, correo)
--   outreach_sequences               63   (plantillas de contacto comercial)
--   knowledge                        21   (incluye "Servicios y precios")
--   demos                            17
--   activities                        2
--
-- En `pg_class.relacl` aparece `anon=arwdDxtm` — las siete letras del CRUD
-- completo — y hay policies `cmd = ALL` con `qual = true`. O sea: no solo se
-- leia, tambien se escribia.
--
-- POR QUE NO SE HABIA VISTO
-- -------------------------
-- `scripts/verify-leak.mjs` existe, pero en dos fallos propios:
--
--   1. NO estaba en `npm run verify` (que es lo que corre CI). Nunca ha corrido
--      solo: habia que acordarse de invocarlo a mano.
--   2. Su `MUST_BE_PRIVATE` decia `['profiles', 'projects']`, que NO son las
--      tablas de este CRM. Preguntar por nombres inexistentes da `ok` sin haber
--      medido nada: una confianza falsa, que es peor que no tener verificador.
--
-- Y la migracion anterior, `20260927_crm_public_read_lockdown.sql`, cierra
-- `public.profiles` y `public.projects`, que son de otro producto. Estas seis no
-- estaban en su lista.
--
-- Que hace
-- --------
-- 1. Inventaria que ve un anonimo ANTES, para que el cambio sea reversible.
-- 2. Cierra lectura Y escritura anonima en las seis.
-- 3. NO borra ni una fila. Los datos siguen ahi por si hay un consumidor, y se
--    puede revertir quitando los grants.
-- 4. NO toca `rr_hub_*`: el hub usa el service client y sus propias policies, y
--    ya se midsio que al anon le da `permission denied`.
-- 5. NO toca `verticals`: son nombres de sector, no datos de contacto, y hay
--    codigo que la lee. Si algun dia hay que cerrarla, se anade aqui con su
--    comprobacion.
--
-- Revertir: volver a dar los grants. Los datos nunca se borran.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 0. Inventario. Esto imprime; no decide nada.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['prospects', 'activities', 'knowledge', 'outreach_sequences', 'demos', 'verticals']
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO n;
    RAISE NOTICE 'INVENTARIO % = % filas (no se borra ninguna)', t, n;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Policies anon. Se quitan las que abren lectura y, sobre todo, escritura.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS prospects_select_anon          ON public.prospects;
DROP POLICY IF EXISTS prospects_write_anon          ON public.prospects;
DROP POLICY IF EXISTS prospects_all_anon            ON public.prospects;
DROP POLICY IF EXISTS activities_all_anon           ON public.activities;
DROP POLICY IF EXISTS outreach_all_anon             ON public.outreach_sequences;
DROP POLICY IF EXISTS demos_all_anon                 ON public.demos;
DROP POLICY IF EXISTS knowledge_all_anon             ON public.knowledge;
DROP POLICY IF EXISTS "Allow all operations"         ON public.knowledge;

-- El policy original en `knowledge` se llama "Allow all operations": es el nombre que
-- pone el boton de la consola de Supabase, no alguien de RR. Sin esta linea el
-- `DROP` de arriba no la quita y la escritura anon se queda abierta.

-- ---------------------------------------------------------------------------
-- 2. Grants. La policy sin el GRANT no hace nada; y al reves. Se cierran los
--    dos, que es lo unico que garantiza el cierre.
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.prospects          FROM anon;
REVOKE ALL ON public.activities         FROM anon;
REVOKE ALL ON public.knowledge          FROM anon;
REVOKE ALL ON public.outreach_sequences FROM anon;
REVOKE ALL ON public.demos              FROM anon;

-- ---------------------------------------------------------------------------
-- 3. La puerta de salida para el servicio, por si algun dia hay que leer algo
--    desde el servidor sin service role: sigue teniendo lo que tenia.
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.knowledge TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Comprobacion. Si esto no dice "crm cerrado", la migracion esta incompleta y
--    `verify-leak.mjs` lo dira en el siguiente push.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  restantes text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname)
    INTO restantes
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('prospects', 'activities', 'knowledge', 'outreach_sequences', 'demos')
     AND pg_has_role('anon', c.oid, 'SELECT');

  IF restantes IS NULL THEN
    RAISE NOTICE 'crm cerrado: el anon no lee ninguna de las cinco tablas';
  ELSE
    RAISE EXCEPTION 'crm abierto todavia: %', restantes;
  END IF;
END $$;