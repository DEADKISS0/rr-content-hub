"""Borra las filas de una idea de prueba del RR Content Hub.

Lo invoca el e2e `la página de creación se abre y el botón responde`, que SÍ crea
una pieza real en producción. Sin esta limpieza, cada corrida deja una fila más y
el contador del tablero miente: 26 piezas pasaron a 27 sin que nadie lo hiciera.

El SQL llega en un archivo y el token por argumento, nunca por línea de comandos:
así lo que se ejecuta se puede leer antes de correrlo, y el token no queda en el
historial del shell.

Dos cosas de esta API que no son obvias:

1. Ejecuta el SQL con POST. Con DELETE y cuerpo responde 201 y no borra nada.
2. Responde 201 con `[]` tanto si borró como si no. Un `[]` no significa "no
   había nada": significa "no te lo digo". Por eso el borrado se comprueba con
   un SELECT, y no con la respuesta del DELETE.

Uso: borrar-idea-prueba.py <archivo.sql> <access_token>
Devuelve 0 si limpió, 1 si algo quedó. El e2e trata un fallo como fallo de
prueba: es preferible una suite roja a una base de clientes con filas de prueba.
"""

import json
import re
import sys
import urllib.error
import urllib.request

# El proyecto vive en la cuenta dueña del hub, no en la de sazon/rr-aliados.
PROYECTO = "ntgtvtzbjwotuwkiflar"
ENDPOINT = f"https://api.supabase.com/v1/projects/{PROYECTO}/database/query"


def pedir(sql: str, token: str):
    """Ejecuta `sql` contra la Management API y devuelve el cuerpo interpretado."""
    peticion = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({"query": sql}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=25) as respuesta:
            return json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        print(f"HTTP {error.code}: {error.read().decode('utf-8')[:300]}", file=sys.stderr)
        raise SystemExit(1)
    except Exception as error:  # noqa: BLE001 - al test solo le sirve el fallo
        print(f"falló la petición: {error}", file=sys.stderr)
        raise SystemExit(1)


def main() -> int:
    if len(sys.argv) != 3:
        print("uso: borrar-idea-prueba.py <archivo.sql> <access_token>", file=sys.stderr)
        return 2

    ruta_sql, token = sys.argv[1], sys.argv[2]
    with open(ruta_sql, encoding="utf-8") as archivo:
        sql = archivo.read().strip()

    if not sql:
        print("SQL vacío: no se ejecuta nada.", file=sys.stderr)
        return 1

    cuerpo = pedir(sql, token)
    if isinstance(cuerpo, dict) and "error" in cuerpo:
        print(f"error de Postgres: {cuerpo['error']}", file=sys.stderr)
        return 1

    # Para comprobar el borrado hace falta saber sobre qué filas se hizo. La
    # última sentencia `delete from rr_hub_ideas` trae el `where`; de ahí sale la
    # pregunta de control.
    borrados = [linea for linea in sql.splitlines() if "delete from rr_hub_ideas" in linea.lower()]
    if not borrados:
        print("el SQL no borra de rr_hub_ideas: no hay nada que verificar.", file=sys.stderr)
        return 1

    donde = re.sub(r"^\s*delete\s+from\s+rr_hub_ideas\s+where\s+", "", borrados[-1], flags=re.I)
    donde = donde.rstrip(";").strip()
    if not donde:
        print("la sentencia de borrado no tiene where: no se ejecuta por seguridad.", file=sys.stderr)
        return 1

    restante = pedir(f"select count(*)::int as n from rr_hub_ideas where {donde}", token)

    if isinstance(restante, list) and restante and restante[0].get("n", 0) > 0:
        print(f"quedan {restante[0]['n']} filas de la idea de prueba.", file=sys.stderr)
        return 1

    print("limpieza ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
