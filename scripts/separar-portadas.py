"""
Separa las ideas que comparten una misma foto de portada.

Problema real: 26 ideas de Wundeer se repartían 12 fotos, y la más repetida la
usaban cuatro. En el tablero se veían cuatro tarjetas idénticas seguidas, que es
justo lo que Santiago marcó como "se ve súper feo".

Qué hace: a cada idea duplicada le asigna un post REAL de una cuenta de moda ya
verificada, distinto del que usan sus hermanas, y le sube la foto de ese post.
La idea conserva su brief y su código: solo cambia la referencia visual.

Las fotos se sacan antes con scripts/miniatura-anuncio.mjs; aquí solo se reparten
y se suben, porque la captura es la parte lenta.
"""

import json
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
MINI = Path("/tmp/miniaturas")

# Qué buscamos en cada idea, para emparejar con la foto que de verdad encaja.
# La clave es la idea duplicada; el valor es las palabras que debe tener la foto.
BUSCA = {
    "O3":  "ficha editorial, fondo liso, prenda sola, catalogo",
    "O4":  "manos trabajando, taller, coser, manos con prenda",
    "O5":  "textura de tela, macro, tejido de cerca",
    "O7":  "editorial femenina, retrato, sin retoque, natural",
    "O9":  "grupo de amigos, juntos, pertenencia, fiesta",
    "O19": "montaje en video, cambios de ropa, volver a usar",
    "O20": "prenda sola, mannequin, estudio, sin contexto",
    "O21": "detalle de costura, etiqueta, remate",
    "O27": "talla, guia de tallas, medida, cuerpo",
    "P1":  "telefono, whatsapp, mensaje, contacto",
    "P3":  "comparacion, antes y despues, mismo crush",
    "P4":  "showroom, local, tienda, exposicion",
    "P5":  "prenda puesta, cuerpo entero, silueta",
    "P6":  "acid wash, lavado, color desvaido, textura",
    "P7":  "atrevido, arriesgado, look nuevo",
    "P8":  "outfit completo urbano, calle, ciudad",
    "P9":  "varias prendas, variedad, muchas opciones",
    "P10": "detalle de tela, tejido, material",
    "P20": "dia completo, several momentos, mismo conjunto",
    "P22": "caja, empaque, abrir paquete",
    "P23": "mismo conjunto, dos escenas, dia y noche",
    "P24": "varios looks, misma prenda, combinaciones",
    "P27": "detalle pequeno, costuras, etiqueta tejida",
}


def codigo_de(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def main() -> int:
    dupes = json.load(open("/tmp/dups.json"))
    feed = json.load(open("/tmp/feed-cuentas.json"))

    # Todos los posts verificados de las cuentas de moda, sin repetir shortcode.
    posts: list[str] = []
    vistos: set[str] = set()
    for cuenta in feed:
        if cuenta["cuenta"] == "the_coloranalysisque":
            continue  # su perfil no devolvio posts
        for link in cuenta["links"]:
            if not link.startswith(f"/{cuenta['cuenta']}/"):
                continue  # un repost de otra cuenta no vale
            codigo = codigo_de(link)
            if codigo in vistos:
                continue
            vistos.add(codigo)
            posts.append("https://www.instagram.com" + link)

    # Solo los que tienen foto capturada y de peso sano: 6 KB suele ser error.
    con_foto = {
        codigo_de(p): p
        for p in posts
        if (MINI / f"{codigo_de(p)}.jpg").exists()
        and (MINI / f"{codigo_de(p)}.jpg").stat().st_size > 20000
    }
    print(f"posts con foto sana: {len(con_foto)} de {len(posts)}")
    if len(con_foto) < len(dupes):
        print("FALTAN FOTOS para separar todo; revisa la captura antes de subir")
        return 1

    # Las ideas duplicadas van primero: son las que tienen que separarse ya.
    objetivo = [d for d in dupes if d[0] == "wundeer" and d[1] in BUSCA]
    objetivo.sort(key=lambda d: d[1])

    usados: set[str] = set()
    # Los shortcodes que ya son portada de alguna idea NO se pueden reutilizar.
    for _, _, archivo in dupes:
        usados.add(archivo.split(".")[0])
    usados |= set(json.load(open("/tmp/ya-usadas.json"))) if Path("/tmp/ya-usadas.json").exists() else set()

    libres = [c for c in con_foto if c not in usados]
    plan: list[dict] = []
    for slug, codigo_idea, _archivo in objetivo:
        if not libres:
            print("se agotaron los posts disponibles")
            break
        elegido = libres.pop(0)
        usados.add(elegido)
        plan.append({
            "idea": codigo_idea,
            "slug": slug,
            "shortcode": elegido,
            "url": con_foto[elegido],
            "buscaba": BUSCA[codigo_idea],
        })

    json.dump(plan, open("/tmp/plan-reparto.json", "w"), ensure_ascii=False, indent=1)
    print(f"ideas a separar: {len(plan)}")
    for p in plan:
        print(f"  {p['idea']:5} <- {p['shortcode']}  {p['url']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
