#!/usr/bin/env bash
# Aplica la migración aditiva del backend v3 y comprueba el resultado.
#
# El DDL no entra por la API REST ni con la service role key: Supabase no expone
# ninguna función SQL. Los caminos reales son dos y este script los cubre:
#
#   1) CLI con sesión:  supabase login  →  este script hace link + push
#   2) Pegado manual:   ./scripts/apply-pending-backend.sh --print  y pegas el SQL
#                       en el SQL Editor del panel de Supabase (Run)
#
# Después de aplicar, `--verify` comprueba por REST que todo exista de verdad.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION="$REPO_ROOT/supabase/migrations/20260926_hub_v3_board_feed_search.sql"
PROJECT_REF="ntgtvtzbjwotuwkiflar"
ENV_FILE="$REPO_ROOT/.env.local"

say() { printf '%s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$MIGRATION" ] || fail "no encuentro la migración en $MIGRATION"

env_value() { grep -m1 "^$1=" "$ENV_FILE" 2>/dev/null | cut -d= -f2- | tr -d '"' || true; }

# ¿Está el objeto en la base? Se pregunta por REST con la anon key: si la
# columna o la vista no existen, Supabase responde 400/404.
probe() {
  local url key path code
  url="$(env_value NEXT_PUBLIC_SUPABASE_URL)"
  key="$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  [ -n "$url" ] && [ -n "$key" ] || fail "faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local"
  for path in "$@"; do
    code="$(curl -s -o /dev/null -w '%{http_code}' "$url/rest/v1/$path" \
      -H "apikey: $key" -H "Authorization: Bearer $key")"
    case "$code" in
      200|206) say "  LEGIBLE   $path" ;;
      400|404) say "  FALTA     $path" ;;
      401|403) say "  BLOQUEADO $path (RLS o permisos; puede ser normal en vistas)" ;;
      *)       say "  ?        $path (http $code)" ;;
    esac
  done
}

cmd_verify() {
  say "Verificando el estado real del backend contra el proyecto $PROJECT_REF"
  say "Fuga del CRM huérfano (200 = sigue expuesto):"
  probe "profiles?select=id&limit=1" "projects?select=id&limit=1"
  say "Tablas del hub (deben seguir legibles: el hub es público):"
  probe "rr_hub_ideas?select=id&limit=1"
  say "Bucket de assets (existe si dice OK):"
  bucket_status
  say "Backend v3:"
  probe "rr_hub_ideas?select=due_at&limit=1" \
        "rr_hub_ideas?select=published_url&limit=1" \
        "rr_hub_ideas?select=metrics&limit=1" \
        "rr_hub_ideas?select=cover_asset_id&limit=1" \
        "rr_hub_board?select=code&limit=1" \
        "rr_hub_feed?select=code&limit=1" \
        "rpc/rr_hub_search"
  say ""
  say "FALTA en v3 no bloquea el front: no usa ninguna de esas columnas."
  say "FALTA en el CRM significa que la lectura anónima de profiles/projects"
  say "sigue abierta: eso sí conviene aplicarlo."
  say ""
  say "El índice único de códigos no se puede sondear por REST; se comprueba en SQL:"
  say "  select indexname from pg_indexes where indexname = 'rr_hub_ideas_code_unique';"
}

# El bucket se pregunta en la API de Storage, no en PostgREST.
bucket_status() {
  local url key code
  url="$(env_value NEXT_PUBLIC_SUPABASE_URL)"
  key="$(env_value NEXT_PUBLIC_SUPABASE_ANON_KEY)"
  [ -n "$url" ] && [ -n "$key" ] || fail "faltan variables de Supabase en .env.local"
  code="$(curl -s -o /dev/null -w '%{http_code}' "$url/storage/v1/bucket/rr-content-assets" \
    -H "apikey: $key" -H "Authorization: Bearer $key")"
  if [ "$code" = "200" ]; then say "  EXISTE    storage/rr-content-assets"; else say "  FALTA     storage/rr-content-assets (http $code: el bucket no existe)"; fi
}

cmd_print() {
  local file
  say "-- SQL para pegar en el SQL Editor del panel de Supabase ---------------------"
  say "-- Proyecto: $PROJECT_REF"
  say "-- Son dos migraciones aditivas e idempotentes: no borran tablas ni datos."
  say "-- Se pueden pegar juntas en una sola consulta, en este orden."
  for file in "$REPO_ROOT/supabase/migrations/20260926_hub_v3_board_feed_search.sql" \
              "$REPO_ROOT/supabase/migrations/20260927_hub_pending_security.sql"; do
    say ""
    say "-- ===== $(basename "$file") ====="
    say ""
    cat "$file"
  done
  say ""
  say "-- Fin. Pega todo el bloque en:"
  say "--   https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
  say "-- y pulsa Run. Después: $0 --verify"
}

cmd_apply() {
  command -v supabase >/dev/null || fail "no está el CLI de supabase instalado"
  cd "$REPO_ROOT"

  # Ojo: `supabase projects list` puede responder 0 aunque el token sea basura
  # (devuelve {"projects":[]}). Por eso se comprueba que el ref aparezca.
  local visible
  visible="$(timeout 60 supabase projects list 2>/dev/null | grep -c "$PROJECT_REF" || true)"
  if [ "${visible:-0}" -eq 0 ]; then
    say "La sesión del CLI no puede ver el proyecto $PROJECT_REF (o no hay sesión)."
    say "Suele pasar cuando el token pertenece a otra cuenta de Supabase."
    say ""
    say "Dos caminos, los dos de un minuto:"
    say "  A) Entrar con la cuenta dueña del proyecto:   supabase login   → y relanzar $0"
    say "  B) Sin CLI:  $0 --print   y pegar el SQL en el panel:"
    say "     https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
    exit 2
  fi

  say "[1/3] Enlazando el proyecto $PROJECT_REF (pedirá la contraseña de la base)…"
  supabase link --project-ref "$PROJECT_REF" || {
    say "El link falló. Copia el SQL a mano: $0 --print"; exit 2; }
  say "[2/3] Aplicando la migración…"
  supabase db push || {
    say "El push falló. Copia el SQL a mano: $0 --print"; exit 2; }
  say "[3/3] Comprobando…"
  cmd_verify
}

case "${1:---apply}" in
  --print) cmd_print ;;
  --verify) cmd_verify ;;
  --apply|"") cmd_apply ;;
  *) fail "opción desconocida: $1 (usa --apply, --print o --verify)" ;;
esac
