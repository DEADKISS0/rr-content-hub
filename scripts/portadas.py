"""
Portadas que DICEN de qué va la idea.

Santiago, 2026-09-29: "esas portadas que estás poniendo, un asco. O sea, quiero
que cambies eso que sea relacionado con la idea que estás poniendo".

El problema de la ronda anterior: los dibujitos (un vaso, una pizza, dos
rectángulos) los elegí POR LA CATEGORÍA, no por lo que la idea propone. Tres
clientes distintos habrían recibido el mismo cuadrado. Y lo peor: un vaso
dibujado con líneas es un objeto sin sabor, no una portada.

La regla de ahora: la portada sale de la PALABRA de la idea, y siempre lleva
SU texto encima. Un rótulo con la idea ("UNA PRENDA EN EL AIRE", "EL VASO
LLENO") comunica más que cualquier geometría, porque es literalmente de qué
trata la pieza.

Se dibuja con SVG porque no hay ImageMagick ni rsvg en la máquina. El
rasterizado lo hace el navegador (`scripts/svg-a-png.mjs`).

Paleta: fondo hueso `#FFFFF3`, tinta `#070001`, mostaza Candilejas `#ded116`.
Bordes de 2px, sin `rounded`: la gramática del hub.
"""

from __future__ import annotations

import html
import textwrap

HUESO = "#FFFFF3"
TINTA = "#070001"
MOSTAZA = "#ded116"

# Cada portada es (rotulo, frase de apoyo, dibujo). El dibujo es geometría pura
# —rectas, arcos, elipses— y se elige por lo que la idea propone, no por el
# cliente ni por la categoría.
PORTADAS: dict[str, dict] = {
    "vaso": {
        "rotulo": "EL VASO LLENO",
        "pie": "el color se ve antes de probarlo",
        "forma": "vaso",
    },
    "aire": {
        "rotulo": "UNA PRENDA EN EL AIRE",
        "pie": "se desarma y se vuelve a armar sola",
        "forma": "aire",
    },
    "plato": {
        "rotulo": "EL PLATO QUE SE VACÍA",
        "pie": "empieza lleno y termina como queda",
        "forma": "plato",
    },
    "mesa": {
        "rotulo": "LA MESA, PLATO POR PLATO",
        "pie": "corte directo en el mismo plano",
        "forma": "mesa",
    },
    "tela": {
        "rotulo": "LA PRENDA QUE SE MUEVE",
        "pie": "el vuelo se nota antes que la prenda",
        "forma": "tela",
    },
    "bastidores": {
        "rotulo": "LA MESA SIN PULIR",
        "pie": "lo que hay antes de que exista",
        "forma": "bastidores",
    },
    "materia": {
        "rotulo": "LO QUE HAY ANTES",
        "pie": "de la naranja al vaso servido",
        "forma": "materia",
    },
}


def _texto(s: str, x: int, y: int, size: int, *, weight: str = "700",
           anchor: str = "middle", opacidad: float = 1.0) -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="Space Grotesk, Arial, sans-serif" '
        f'font-size="{size}" font-weight="{weight}" text-anchor="{anchor}" '
        f'fill="{TINTA}" opacity="{opacidad}">{html.escape(s)}</text>'
    )


def _mono(s: str, x: int, y: int, size: int, opacidad: float = 1.0) -> str:
    return (
        f'<text x="{x}" y="{y}" font-family="monospace" font-size="{size}" '
        f'fill="{TINTA}" opacity="{opacidad}">{html.escape(s)}</text>'
    )


# ---------------------------------------------------------------- formas


def _vaso() -> str:
    return """
    <path d="M392 372 L438 962 L642 962 L688 372 Z" fill="none" stroke="{t}" stroke-width="2"/>
    <path d="M400 548 L680 548 L666 726 L414 726 Z" fill="{m}" opacity="0.55" stroke="{t}" stroke-width="2"/>
    <line x1="392" y1="372" x2="688" y2="372" stroke="{t}" stroke-width="2"/>
    <circle cx="640" cy="520" r="34" fill="none" stroke="{t}" stroke-width="2"/>
    <line x1="640" y1="486" x2="640" y2="554" stroke="{t}" stroke-width="2"/>
    """.format(t=TINTA, m=MOSTAZA)


def _aire() -> str:
    return """
    <path d="M330 452 L750 452" stroke="{t}" stroke-width="2"/>
    <path d="M330 660 L750 660" stroke="{t}" stroke-width="2"/>
    <path d="M330 860 L750 860" stroke="{t}" stroke-width="2"/>
    <path d="M360 400 L360 900" stroke="{t}" stroke-width="2"/>
    <path d="M720 400 L720 900" stroke="{t}" stroke-width="2"/>
    <path d="M360 452 Q540 380 720 452" fill="none" stroke="{t}" stroke-width="2"/>
    <path d="M360 660 Q540 580 720 660" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="540" cy="856" r="30" fill="{m}" opacity="0.5" stroke="{t}" stroke-width="2"/>
    """.format(t=TINTA, m=MOSTAZA)


def _plato() -> str:
    return """
    <circle cx="540" cy="656" r="286" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="540" cy="656" r="206" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="452" cy="586" r="30" fill="{m}" opacity="0.5" stroke="{t}" stroke-width="2"/>
    <circle cx="632" cy="618" r="26" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="512" cy="766" r="28" fill="none" stroke="{t}" stroke-width="2"/>
    <line x1="540" y1="960" x2="540" y2="1030" stroke="{t}" stroke-width="2"/>
    """.format(t=TINTA, m=MOSTAZA)


def _mesa() -> str:
    filas = []
    for fila in range(3):
        y = 470 + fila * 186
        filas.append(f'<line x1="300" y1="{y}" x2="780" y2="{y}" stroke="{TINTA}" stroke-width="2"/>')
        for c in range(4):
            cx = 300 + c * 160
            lleno = (fila * 4 + c) % 3 != 0
            if lleno:
                filas.append(
                    f'<circle cx="{cx + 80}" cy="{y - 100}" r="42" fill="{MOSTAZA}" '
                    f'opacity="0.5" stroke="{TINTA}" stroke-width="2"/>'
                )
            else:
                filas.append(
                    f'<circle cx="{cx + 80}" cy="{y - 100}" r="42" fill="none" '
                    f'stroke="{TINTA}" stroke-width="2" stroke-dasharray="6 6"/>'
                )
    return "\n    ".join(filas)


def _tela() -> str:
    return """
    <path d="M260 992 C 420 600, 700 1040, 850 520" fill="none" stroke="{t}" stroke-width="2"/>
    <path d="M260 892 C 440 520, 700 940, 850 420" fill="none" stroke="{t}" stroke-width="2" stroke-dasharray="10 9"/>
    <circle cx="850" cy="520" r="36" fill="{m}" opacity="0.5" stroke="{t}" stroke-width="2"/>
    <line x1="260" y1="1012" x2="850" y2="1012" stroke="{t}" stroke-width="2"/>
    """.format(t=TINTA, m=MOSTAZA)


def _bastidores() -> str:
    return """
    <rect x="256" y="430" width="240" height="580" fill="none" stroke="{t}" stroke-width="2"/>
    <rect x="584" y="430" width="240" height="580" fill="none" stroke="{t}" stroke-width="2"/>
    <line x1="256" y1="566" x2="496" y2="566" stroke="{t}" stroke-width="2"/>
    <line x1="584" y1="620" x2="824" y2="620" stroke="{t}" stroke-width="2"/>
    <circle cx="376" cy="800" r="66" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="704" cy="760" r="52" fill="none" stroke="{t}" stroke-width="2" stroke-dasharray="8 7"/>
    <path d="M496 800 L584 800" stroke="{t}" stroke-width="2" stroke-dasharray="6 6"/>
    """.format(t=TINTA)


def _materia() -> str:
    return """
    <circle cx="430" cy="640" r="150" fill="none" stroke="{t}" stroke-width="2"/>
    <circle cx="430" cy="640" r="96" fill="{m}" opacity="0.5" stroke="{t}" stroke-width="2"/>
    <path d="M640 470 L760 470 L742 900 L658 900 Z" fill="none" stroke="{t}" stroke-width="2"/>
    <path d="M646 610 L754 610 L748 720 L652 720 Z" fill="{m}" opacity="0.55" stroke="{t}" stroke-width="2"/>
    <line x1="430" y1="470" x2="430" y2="410" stroke="{t}" stroke-width="2"/>
    <path d="M600 640 L640 640" stroke="{t}" stroke-width="2" stroke-dasharray="6 6"/>
    <text x="540" y="1000" font-family="monospace" font-size="22" fill="{t}" opacity="0.55">&#8594;</text>
    """.format(t=TINTA, m=MOSTAZA)


FORMAS = {
    "vaso": _vaso,
    "aire": _aire,
    "plato": _plato,
    "mesa": _mesa,
    "tela": _tela,
    "bastidores": _bastidores,
    "materia": _materia,
}


# ---------------------------------------------------------------- portada


def portada(forma: str, codigo: str, cliente: str = "CANDILEJAS",
            ancho: int = 1080, alto: int = 1350) -> str:
    """Portada 4:5 con el rótulo de la idea encima de su geometría."""
    p = PORTADAS[forma]

    # El rótulo se parte en líneas que caben: a 62 px el ancho útil es ~900 px.
    palabras = p["rotulo"].upper().split(" ")
    lineas = []
    actual = ""
    for palabra in palabras:
        tentativa = (actual + " " + palabra).strip()
        if len(tentativa) > 17 and actual:
            lineas.append(actual)
            actual = palabra
        else:
            actual = tentativa
    if actual:
        lineas.append(actual)

    alto_rotulo = 72
    y0 = 232
    rotulo = "\n    ".join(
        _texto(linea, ancho // 2, y0 + i * alto_rotulo, 62) for i, linea in enumerate(lineas)
    )

    pie_lineas = textwrap.wrap(p["pie"].upper(), width=46)
    pie = "\n    ".join(
        _mono(linea, ancho // 2, 1148 + i * 32, 22, 0.7) for i, linea in enumerate(pie_lineas)
    )

    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="{ancho}" height="{alto}" viewBox="0 0 {ancho} {alto}">
  <rect width="{ancho}" height="{alto}" fill="{HUESO}"/>
  <rect x="0" y="0" width="{ancho}" height="12" fill="{MOSTAZA}"/>
  <rect x="48" y="48" width="{ancho - 96}" height="{alto - 96}" fill="none" stroke="{TINTA}" stroke-width="2"/>
  <line x1="48" y1="150" x2="{ancho - 48}" y2="150" stroke="{TINTA}" stroke-width="2"/>
  <line x1="48" y1="1082" x2="{ancho - 48}" y2="1082" stroke="{TINTA}" stroke-width="2"/>
  {_mono(f"{codigo} · {cliente}", 78, 112, 24, 0.62)}
  {rotulo}
  <g>
    {FORMAS[forma]()}
  </g>
  {pie}
  {_mono("PORTADA DE TRABAJO · NO ES LA FOTO FINAL", ancho // 2, alto - 84, 20, 0.5)}
</svg>"""
