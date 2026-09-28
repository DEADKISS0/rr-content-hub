"""Valida la sintaxis PostgreSQL de una migración con pglast, sin servidor.

`pglast` vive en el python de las herramientas de Hermes, no en el del sistema:
`/usr/bin/python3` y el `python3` a secas NO lo tienen, aunque `pip list` diga que
sí — el pip es de otra instalación. Por eso este script se ejecuta con el
intérprete que se le pase, no con `python3` a secas.

Uso: validar-sql.py <ruta.sql>
Devuelve 0 si la sintaxis es válida.
"""

import pathlib
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: validar-sql.py <ruta.sql>", file=sys.stderr)
        return 2

    ruta = pathlib.Path(sys.argv[1])
    if not ruta.exists():
        print(f"no existe: {ruta}", file=sys.stderr)
        return 2

    try:
        import pglast
    except ImportError:
        print("pglast no está en este intérprete", file=sys.stderr)
        return 1

    sql = ruta.read_text(encoding="utf-8")
    try:
        sentencias = pglast.parse_sql(sql)
    except Exception as error:  # noqa: BLE001 - el script solo necesita el fallo
        print(f"SINTAXIS INVALIDA: {error}", file=sys.stderr)
        return 1

    print(f"OK  {ruta.name}: {len(sentencias)} sentencias, sintaxis PostgreSQL válida")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
