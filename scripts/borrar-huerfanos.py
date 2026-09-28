"""Borra del bucket los objetos que ningun asset referencia.

Uso: borrar-huerfanos.py [--dry]

Por que existe: subir una portada deja el objeto en storage ANTES de registrar
el asset. Si el registro falla, el objeto se queda sin fila que lo apunte: bytes
que nadie puede ver, que ocupan y que un dia aparecen en un listado de storage
como material de la marca.

No se puede borrar con SQL: `storage.protect_delete()` lanza
`42501 Direct deletion from storage tables is not allowed. Use the Storage API
instead.` Es una proteccion a proposito, y la via que queda es la Storage API con
la service role.

El `delete` de la Storage API responde 200 con `[]` tanto si borro como si no,
Igual que la Management API: por eso este script VERIFICA con un SELECT de
storage.objects al final, en vez de creerse la respuesta.
"""

import json
import pathlib
import sys
import urllib.error
import urllib.request

REF = "ntgtvtzbjwotuwkiflar"
BUCKET = "rr-content-assets"
MCP_TOKEN = pathlib.Path.home() / ".hermes/mcp-tokens/supabase.json"


def management(query: str) -> str:
    tok = json.loads(MCP_TOKEN.read_text())["access_token"]
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        method="POST",
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode()


def service_role() -> str:
    tok = json.loads(MCP_TOKEN.read_text())["access_token"]
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/api-keys",
        headers={"Authorization": f"Bearer {tok}"},
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        for k in json.loads(resp.read().decode()):
            if k.get("type") == "legacy" and k.get("name") == "service_role":
                return k["api_key"]
    raise SystemExit("no se encontro la llave service_role")


def main() -> int:
    dry = "--dry" in sys.argv
    huerfanos = json.loads(
        management(
            f"""
            select o.name from storage.objects o
             where o.bucket_id = '{BUCKET}'
               and not exists (
                 select 1 from public.rr_hub_assets a where a.storage_path = o.name)
             order by o.name;
            """
        )
    )
    print(f"objetos sin asset que los apunte: {len(huerfanos)}")
    for h in huerfanos:
        print("  ", h["name"])

    if dry:
        print("\n--dry: no se borra nada")
        return 0
    if not huerfanos:
        print("\nnada que borrar")
        return 0

    key = service_role()
    for h in huerfanos:
        req = urllib.request.Request(
            f"https://{REF}.supabase.co/storage/v1/object/{BUCKET}/{h['name']}",
            method="DELETE",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                print(f"borrado {resp.status} {h['name'].split('/')[-1]}")
        except urllib.error.HTTPError as exc:
            print(f"FALLO {exc.code} {h['name']}: {exc.read().decode()[:200]}")

    # La prueba que vale: un SELECT, no la respuesta del DELETE.
    quedan = json.loads(
        management(
            f"""
            select count(*) as n from storage.objects o
             where o.bucket_id = '{BUCKET}'
               and not exists (
                 select 1 from public.rr_hub_assets a where a.storage_path = o.name);
            """
        )
    )[0]["n"]
    total = json.loads(
        management(
            f"select count(*) as n from storage.objects where bucket_id = '{BUCKET}';"
        )
    )[0]["n"]
    vivas = json.loads(
        management(
            f"""
            select count(*) as n from public.rr_hub_assets a
              join public.rr_hub_ideas i on i.cover_asset_id = a.id;
            """
        )
    )[0]["n"]
    print(f"\nhuerfanos restantes: {quedan}  (esperado 0)")
    print(f"objetos totales en el bucket: {total}")
    print(f"portadas vivas: {vivas}")
    return 0 if quedan == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
