"""Prueba las partes puras del generador, sin red y sin base de datos.

Lo que NO se prueba aquí (y por qué):
- La llamada al redactor: necesita la flota y tarda minutos. Se probó a mano.
- La inserción en Supabase: escribir en producción desde un test es justo lo que
  este repo ya aprendió a no hacer a ciegas. La corrida real va con `--seco` y
  después se verifica con un SELECT.
"""

import importlib.util
import pathlib
import sys

RUTA = pathlib.Path(__file__).resolve().parent.parent / "scripts" / "generar-ideas-wundeer.py"

spec = importlib.util.spec_from_file_location("generador", RUTA)
generador = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generador)

fallos = 0


def comprobar(nombre, condicion, detalle=""):
    global fallos
    if condicion:
        print(f"PASS  {nombre}")
    else:
        print(f"FAIL  {nombre} — {detalle}")
        fallos += 1


# ── El parser del redactor: el punto que mas falla en la practica ────────────
crudo = """Claro, aqui van las ideas:

```json
[{"title":"La sombra como acento","description":"Contraste duro","objective":"Mostrar textura","camera_brief":"Luz lateral","talent_brief":"Sin personas","edit_brief":"Corte seco"},{"title":"El detalle que nadie mira","description":"Macro","objective":"Humanizar","camera_brief":"Macro real","talent_brief":"Manos","edit_brief":"Texto pequeno"}]
```

Espero que te sirva."""
parseado = generador.parsear_json_desde_texto(crudo, "organic")
comprobar("parsea un array envuelto en texto y en cercas de codigo", len(parseado) == 2, str(len(parseado)))
comprobar("conserva el titulo de la primera", parseado[0]["title"] == "La sombra como acento", parseado[0].get("title"))
comprobar("descarta elementos sin titulo", len(generador.parsear_json_desde_texto('[{"x":1},{"title":"si"}]', "paid")) == 1)

for mala in ("no hay json", '[{"title":}]', "[]"):
    try:
        generador.parsear_json_desde_texto(mala, "paid")
        fallo_real = False
    except RuntimeError:
        fallo_real = True
    comprobar(f"rechaza {mala!r}", fallo_real)

# Las comillas tipograficas aparecen mucho en la salida de los bots. Los cuatro
# caracteres se nombran por su punto de codigo: escritos a ojo, apertura y cierre
# se ven iguales y el test pasaria sin comprobar nada.
#
# El caso que se prueba es el REAL: el bot usa tipograficas como delimitadores
# del valor. Convertirlas deja un JSON valido, que es justo lo que hace falta.
# No se prueba la tipografica decorativa dentro de un valor que ya tiene sus
# comillas JSON: ahi no hay forma de saber cual de las dos comillas era la
# buena, y el parser lo rechaza en vez de inventar el valor.
Q = chr(34)
APERTURA_DOBLE, CIERRE_DOBLE = chr(0x201C), chr(0x201D)
APERTURA_SIMPLE, CIERRE_SIMPLE = chr(0x2018), chr(0x2019)

delimitadas = "[" + "{" + Q + "title" + Q + ":" + APERTURA_DOBLE + "bonitas" + CIERRE_DOBLE + "}" + "]"
comprobar(
    "convierte tipograficas usadas como delimitador",
    generador.parsear_json_desde_texto(delimitadas, "paid")[0]["title"] == "bonitas",
    repr(delimitadas),
)

simples = "[" + "{" + Q + "title" + Q + ":" + APERTURA_SIMPLE + "clave" + CIERRE_SIMPLE + "}" + "]"
comprobar(
    "convierte tipograficas simples a apostrofe",
    generador.parsear_json_desde_texto(simples, "paid")[0]["title"] == "clave",
    repr(simples),
)


# ── El paquete de WhatsApp ───────────────────────────────────────────────────
creadas = [("P3", "paid", "id-1"), ("P4", "paid", "id-2"), ("O18", "organic", "id-3"), ("O19", "organic", "id-4")]
paquete = generador.empaquetar(creadas)
comprobar("el paquete anuncia 2 pauta y 2 organico", "2 pauta · 2 orgánico" in paquete, paquete[:80])
comprobar("el paquete trae los cuatro enlaces", paquete.count("rr-content-hub.vercel.app/wundeer/ideas/") == 4, str(paquete.count("rr-content-hub.vercel.app")))
comprobar("el paquete explica la regla de mayoria", "más votos a favor que en contra" in paquete)
comprobar("el paquete NO lleva rutas locales", "/home/" not in paquete)
comprobar("el paquete NO lleva conteos internos", "total" not in paquete.lower())

# El caso borde: si solo salio organico, el paquete no debe mentir diciendo 2.
solo_organico = generador.empaquetar([("O18", "organic", "id-3")])
comprobar("con una sola idea, el paquete no inventa las otras", "0 pauta · 1 orgánico" in solo_organico, solo_organico[:80])
comprobar("con una sola idea no imprime la seccion PAUTA vacia", "*PAUTA*" not in solo_organico)

# Que la idea generada nace en revision interna, no en borrador ni en el cliente.
comprobar("las ideas nacen en revision interna", generador.ESTADO_NACIMIENTO == "internal_review", generador.ESTADO_NACIMIENTO)

print()
if fallos == 0:
    print("TODO OK")
    sys.exit(0)
print(f"{fallos} FALLO(S)")
sys.exit(1)
