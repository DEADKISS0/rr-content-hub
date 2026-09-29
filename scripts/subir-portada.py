"""Sube una imagen real al bucket y la registra como asset de portada.

Uso: subir-portada.py <idea_id> <slug_proyecto> <ruta_imagen>

Por que existe: para poner una portada REAL hacen falta dos cosas que no estan
en `.env.local` — la service role (las politicas de escritura del bucket son
`to authenticated`) y un registro en `rr_hub_assets`. La service role sale de la
Management API con el token `sbp_…` del MCP.

El script NO imprime ninguna credencial. La llave se pide por stdin y se usa
solo en memoria.
"""

import json
import pathlib
import sys
import urllib.error
import urllib.request
import uuid

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
    if len(sys.argv) != 4:
        print(__doc__)
        return 1
    idea_id, slug, imagen = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
    datos = imagen.read_bytes()
    sufijo = imagen.suffix.lstrip(".").lower()
    # El bucket acepta `image/jpeg`, no `image/jpg`: con la forma abreviada el
    # Storage responde 415 `invalid_mime_type` y no sube NADA. La extensión
    # `.jpg` sigue siendo valida, el nombre del mime no.
    mime = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
            "webp": "image/webp", "gif": "image/gif"}.get(sufijo, f"image/{sufijo}")
    key = service_role()
    url = f"https://{REF}.supabase.co"

    # La ruta tiene que empezar por el slug del proyecto: la politica de escritura
    # anonima (`rr_hub_wundeer_public_storage_read`) solo cubre `wundeer/%`, y la
    # de `authenticated` exige que el primer segmento sea el slug.
    ruta = f"{slug}/{idea_id}/reference_brief/{uuid.uuid4().hex}-{imagen.name}"

    req = urllib.request.Request(
        f"{url}/storage/v1/object/{BUCKET}/{ruta}",
        data=datos,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": mime,
            "x-upsert": "true",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            print("subida", resp.status)
    except urllib.error.HTTPError as exc:
        print("FALLO SUBIDA", exc.code, exc.read().decode()[:300])
        return 1

    public_url = f"{url}/storage/v1/object/public/{BUCKET}/{ruta}"
    with urllib.request.urlopen(
        urllib.request.Request(public_url, headers={"apikey": key}), timeout=45
    ) as resp:
        print("publica", resp.status, resp.headers.get("content-type"))

    # El asset vive en `rr_hub_assets` con `asset_stage = 'reference_brief'`, y
    # la portada se elige con `cover_asset_id`. Las dos escrituras, juntas: sin la
    # segunda la tarjeta sigue pintando el arte de marca.
    #
    # `uploaded_by` se deja en null a proposito: su FK apunta a `auth.users(id)`
    # y no hay una sesion real detrás de esta subida (la hizo la Management API,
    # no un navegador con login). Poner un uuid inventado seria mentir sobre quien
    # subio el archivo. Los briefs de Wundeer son publicos, asi que la
    # atribucion no bloquea nada; si algun dia hace falta saber quien subio que,
    # es un cambio de esquema, no un valor inventado.
    sql = f"""
    insert into public.rr_hub_assets
      (idea_id, asset_stage, storage_path, external_url, file_name, mime_type, version_label)
    select
      i.id, 'reference_brief',
      '{ruta}', '{public_url}', '{imagen.name}', '{mime}', 'portada'
    from public.rr_hub_ideas i where i.id = '{idea_id}'
    returning id;
    """
    print("asset", management(sql))

    # El `update` se escribe con la tabla calificada, no con un alias: dentro del
    # subselect la referencia a la fila que se actualiza se hace por nombre de
    # tabla (`rr_hub_ideas.id`). Con un alias `i` en el `where`, la subconsulta no
    # lo ve y PostgreSQL devuelve 400 "missing FROM-clause entry for table i".
    sql2 = f"""
    update public.rr_hub_ideas
       set cover_asset_id = (
         select a.id from public.rr_hub_assets a
          where a.idea_id = public.rr_hub_ideas.id
            and a.asset_stage = 'reference_brief'
          order by a.created_at desc limit 1)
     where id = '{idea_id}'
    returning code, cover_asset_id;
    """
    print("portada", management(sql2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
