"""Borra las filas de una idea de prueba del RR Content Hub.

Lo invoca el e2e `la página de creación se abre y el botón responde`, que SÍ crea
una pieza real en producción. Sin esta limpieza, cada corrida deja una fila más y
el contador del tablero miente: 26 piezas pasaron a 27 sin que nadie lo hiciera.

El SQL llega en un archivo y el token por argumento, nunca por línea de comandos:
así lo que se ejecuta se puede leer antes de correrlo, y el token no queda en el
historial del shell.

Uso: borrar-idea.py <archivo.sql> <access_token>
Devuelve 0 si limpió, 1 si falló. El e2e trata un fallo como fallo de prueba: es
preferible una suite roja a una base de clientes con filas de prueba.
"""

import json
import sys
import urllib.error
import urllib.request

# El proyecto vive en la cuenta dueña del hub, no en la de sazon/rr-aliados.
PROYECTO = "ntgtvtzbjwotuwkiflar"
ENDPOINT = f"https://api.supabase.com/v1/projects/{PROYECTO}/database/query"


def main() -> int:
    if len(sys.argv) != 3:
        print("uso: borrar-idea.py <archivo.sql> <access_token>", file=sys.stderr)
        return 2

    ruta_sql, token = sys.argv[1], sys.argv[2]
    with open(ruta_sql, encoding="utf-8") as archivo:
        sql = archivo.read().strip()

    if not sql:
        print("SQL vacío: no se ejecuta nada.", file=sys.stderr)
        return 1

    peticion = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(peticion, timeout=25) as respuesta:
            cuerpo = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(f"HTTP {error.code}: {error.read().decode('utf-8')[:300]}", file=sys.stderr)
        return 1
    except Exception as error:  # noqa: BLE001 - al test solo le sirve el fallo
        print(f"falló la petición: {error}", file=sys.stderr)
        return 1

    # La Management API devuelve 201 con `[]` cuando el DDL pasó. Cada sentencia
    # borrada devuelve una lista; lo que importa es que ninguna haya fallado.
    if isinstance(cuerpo, dict) and "error" in cuerpo:
        print(f"error de Postgres: {cuerpo['error']}", file=sys.stderr)
        return 1

    print("limpieza ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
