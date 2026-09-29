import json, os, re, sys, urllib.request, urllib.error
from pathlib import Path

"""
Asigna una referencia REAL a las ideas que no tienen, y solo si la propuesta
tiene sentido. Si no, dice por qué y no toca nada.

La regla dura, y es la razón de que este script exista:

    NO SE INVENTA UNA REFERENCIA.

Una referencia es una pieza de otra persona. Si se le pone a una idea un reel que
no tiene nada que ver, el equipo pierde la confianza en TODO lo demás del hub: no
es un error de una fila, es el momento en que dejan de creerse las ideas. Por eso
este script NUNCA elige: propone, y que Dirección elija.

Cómo propone: cada idea se busca contra el título y el objetivo de los anuncios
de la biblioteca, y solo se propone si hay un parecido REAL de tema. Sin parecido,
la idea se queda sin referencia y se reporta — que es la respuesta honesta.

Uso:
    python3 scripts/proponer-referencias.py            # solo informa
    python3 scripts/proponer-referencias.py --aplicar  # escribe lo que propose
"""

RAIZ = Path(__file__).resolve().parent.parent

def conexion():
    ruta = Path.home() / ".hermes/mcp-tokens/supabase.json"
    return json.load(ruta.open())["access_token"]

def sql(tok, q):
    req = urllib.request.Request(
        "https://api.supabase.com/v1/projects/ntgtvtzbjwotuwkiflar/database/query",
        data=json.dumps({"query": q}).encode(), method="POST",
        headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"SQL fallo: {e.read().decode()[:300]}")

# Palabras que no sirven para comparar: son de toda idea de moda y aparecen en
# todas, así que no distinguen nada.
VACIAS = {"la", "el", "los", "las", "un", "una", "unos", "unas", "de", "del", "que",
          "y", "a", "en", "con", "por", "para", "sin", "lo", "al", "es", "no", "se",
          "tu", "tuya", "mas", "más", "lo", "como", "sin", "este", "esta", "todo",
          "nada", "algo", "muy", "ya", "le", "les", "me", "te", "nos", "os"}

def palabras(texto):
    limpio = re.sub(r"[^a-záéíóúñü0-9 ]", " ", (texto or "").lower())
    return {p for p in limpio.split() if len(p) > 3 and p not in VACIAS}

def similitud(idea, anuncio):
    """Palabras compartidas. No es semántica: es una pista, y por eso la
    persona decide. Preferimos coincidencia de palabras RARAS: «talla» pesa más
    que «prenda»."""
    a, b = palabras(idea), palabras(anuncio)
    if not a or not b:
        return 0.0, set()
    comunes = a & b
    peso = sum(1.0 / len(p) for p in comunes)      # palabras cortas pesan menos
    return peso / max(1, len(comunes)) * min(1, len(comunes) / 2), comunes

def propuestas(tok, proyecto, anuncios):
    sin = sql(tok, f"""
        select id, code, title, objective, content_type
        from rr_hub_ideas
        where project_id='{proyecto}'
          and (reference_urls is null or jsonb_array_length(reference_urls)=0)
        order by code""")
    ideas = sin if isinstance(sin, list) else []
    ideas = [i for i in ideas if i.get("title")]

    resultados = []
    for idea in ideas:
        texto = f"{idea['title']} {idea.get('objective') or ''}"
        mejor, mejor_puntaje, comunes = None, 0.0, set()
        for anuncio in anuncios:
            pun, com = similitud(texto, f"{anuncio['name']} {anuncio.get('objective') or ''}")
            if pun > mejor_puntaje:
                mejor, mejor_puntaje, comunes = anuncio, pun, com
        # El corte es 0.34: por debajo de eso, dos palabras sueltas en comun no
        # son un parecido, son una coincidencia. No se propone.
        if mejor and mejor_puntaje >= 0.34:
            resultados.append((idea, mejor, round(mejor_puntaje, 2), sorted(comunes)))
        else:
            resultados.append((idea, None, round(mejor_puntaje, 2), []))
    return resultados

def main():
    aplicar = "--aplicar" in sys.argv
    tok = conexion()
    proyecto = sql(tok, "select id from rr_hub_projects where slug='wundeer'")[0]["id"]
    anuncios = sql(tok, f"""
        select id, name, platform, external_url, objective
        from rr_hub_ad_library
        where project_id='{proyecto}' and active""")

    res = propuestas(tok, proyecto, anuncios)
    con, sin = [r for r in res if r[1]], [r for r in res if not r[1]]

    print(f" Ideas sin referencia: {len(res)}")
    print(f" Con propuesta de la biblioteca: {len(con)}")
    print(f" Sin parecido real (se quedan como estan): {len(sin)}\n")

    if con:
        print(" PROPUESTAS (no se aplican sin --aplicar):")
        for idea, anuncio, puntaje, comunes in con:
            print(f"   {idea['code']:5} {idea['title'][:40]:42} <- {anuncio['platform']:9} {anuncio['name'][:24]:26} {puntaje}  {comunes}")

    if sin:
        print("\n SIN PROPUESTA — y por que no se inventa:")
        for idea, _, puntaje, _ in sin:
            print(f"   {idea['code']:5} {idea['title'][:44]:46} mejor parecido: {puntaje} (corte 0.34)")

    if not aplicar:
        print("\n Nada escrito. Para escribir lo de arriba: --aplicar")
        return

    if not con:
        print("\n No hay nada que aplicar.")
        return

    print("\n Aplicando...")
    for idea, anuncio, _, _ in con:
        sql(tok, f"""update rr_hub_ideas
            set reference_urls = '["{anuncio['external_url']}"]'::jsonb, updated_at=now()
            where id='{idea['id']}'""")
        estado = sql(tok, f"select status from rr_hub_ideas where id='{idea['id']}'")[0]["status"]
        sql(tok, f"""insert into rr_hub_events
            (idea_id,from_status,to_status,comment,actor_label)
            values ('{idea['id']}','{estado}','{estado}',
                    'Referencia propuesta desde la biblioteca: {anuncio['platform']} · {anuncio['name']}.',
                    'biblioteca · propuesta')""")
        print(f"   {idea['code']} <- {anuncio['name']}")

    # Verificacion. Siempre. Un UPDATE que dice "ok" no es un UPDATE que pasó.
    quedan = sql(tok, f"""
        select count(*) as n from rr_hub_ideas
        where project_id='{proyecto}'
          and (reference_urls is null or jsonb_array_length(reference_urls)=0)""")
    print(f"\n VERIFICACION: quedan sin referencia {quedan[0]['n']}")

if __name__ == "__main__":
    main()
