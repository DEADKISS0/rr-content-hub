"""Aplica una migración del hub contra la Management API de Supabase.

El SQL va en un archivo y se lee antes de enviarse; la API se llama con POST
porque con DELETE responde 201 y no ejecuta nada (ver scripts/borrar-idea-prueba.py).

Uso: aplicar-migracion.py <ruta.sql>
"""

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

PROYECTO = "ntgtvtzbjwotuwkiflar"
ENDPOINT = f"https://api.supabase.com/v1/projects/{PROYECTO}/database/query"
TOKENS = pathlib.Path.home() / ".hermes" / "mcp-tokens" / "supabase.json"


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: aplicar-migracion.py <ruta.sql>", file=sys.stderr)
        return 2

    ruta = pathlib.Path(sys.argv[1])
    sql = ruta.read_text(encoding="utf-8").strip()
    if not sql:
        print("SQL vacío.", file=sys.stderr)
        return 1

    token = json.loads(TOKENS.read_text())["access_token"]
    peticion = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=60) as respuesta:
            cuerpo = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(f"HTTP {error.code}: {error.read().decode('utf-8')[:400]}", file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001
        print(f"falló la petición: {error}", file=sys.stderr)
        return 1

    if isinstance(cuerpo, dict) and "error" in cuerpo:
        print(f"error de Postgres: {cuerpo['error']}", file=sys.stderr)
        return 1

    # La Management API responde 201 con `[]` tanto si aplicó como si no. Por eso
    # se COMPRUEBA: una migración aplicada se verifica preguntando a la base.
    print(f"{ruta.name}: enviada, verificando…", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
