#!/usr/bin/env bash
# Aplica la migración aditiva del backend v3 y comprueba el resultado.
#
# El DDL no entra por la API REST ni con la service role key: Supabase no expone
# ninguna función SQL. Los caminos reales son dos y este script los cubre:
#
#   1) CLI con sesión:  supabase login  →  este script hace link + push
#   2) Pegado manual:   ./scripts/apply-backend-v3.sh --print  y pegas el SQL
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
      200|206) say "  OK        $path" ;;
      400|404) say "  FALTA     $path" ;;
      401|403) say "  BLOQUEADO $path (RLS o permisos; puede ser normal en vistas)" ;;
      *)       say "  ?        $path (http $code)" ;;
    esac
  done
}

cmd_verify() {
  say "Verificando el backend v3 contra el proyecto $PROJECT_REF"
  say "Columnas nuevas de rr_hub_ideas:"
  probe "rr_hub_ideas?select=due_at&limit=1" \
        "rr_hub_ideas?select=published_url&limit=1" \
        "rr_hub_ideas?select=metrics&limit=1" \
        "rr_hub_ideas?select=cover_asset_id&limit=1"
  say "Vistas y búsqueda:"
  probe "rr_hub_board?select=code&limit=1" \
        "rr_hub_feed?select=code&limit=1" \
        "rpc/rr_hub_search"
  say ""
  say "Si ves FALTA, la migración todavía no está aplicada (el front funciona igual:"
  say "no usa ninguna de esas columnas)."
}

cmd_print() {
  say "-- SQL para pegar en el SQL Editor del panel de Supabase ---------------------"
  say "-- Proyecto: $PROJECT_REF  ·  Es aditivo: no borra tablas ni toca datos."
  say ""
  cat "$MIGRATION"
  say ""
  say "-- Fin. Pega todo el bloque en https://supabase.com/dashboard/project/$PROJECT_REF/sql/new y pulsa Run."
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
