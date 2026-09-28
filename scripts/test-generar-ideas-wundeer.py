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
# ── Un fallo de medio pack tiene que verse EN el mensaje ────────────────────
# El 2026-09-28 el redactor devolvio solo 2 ideas de las 4. El script lo registro
# en stderr y sigio como si nada: el pack decia "0 pauta · 2 organico" con el
# texto de "Entran en revision interna" al final, y parecia una corrida normal.
# Media corrida puede perderse sin que nadie lo note si el hueco no se dice.
completo = generador.empaquetar([("P11","paid","a"),("P12","paid","b"),("O19","organic","c"),("O20","organic","d")])
comprobar("el pack completo no avisa de nada", "No salieron" not in completo, completo[:80])
comprobar("el pack completo anuncia 2 y 2", "2 pauta · 2 orgánico" in completo, completo[:80])

medio = generador.empaquetar([("O19","organic","c"),("O20","organic","d")],
                             [("paid", "el redactor no devolvio array JSON")])
comprobar("el hueco se dice en el mensaje", "No salieron las de pauta" in medio, medio[-120:])
comprobar("el conteo del hueco es honesto", "0 pauta · 2 orgánico" in medio, medio[:60])
comprobar("un fallo no impide entregar lo que si salio", "O19" in medio)
comprobar("el motivo del fallo no se filtra", "JSON" not in medio, medio[-120:])

losdos = generador.empaquetar([], [("paid","x"),("organic","y")])
comprobar("el aviso usa nombres legibles, no codigos", "pauta, orgánico" in losdos, losdos[:90])
comprobar("'paid' y 'organic' no llegan al mensaje", "paid" not in losdos and "organic" not in losdos, losdos[:90])

# ── Respuesta cortada a mitad ──────────────────────────────────────────────
# Lo que pasó de verdad el 2026-09-28 a las 08:00: el redactor se cortó
# escribiendo y el array no cerró. El parser tiraba TODO, y con él una idea
# de pauta que ya venía bien escrita. Se rescatan las que sí cierran.
entera = '{"title":"Entera","description":"d","objective":"o"}'
cortada = '{"title":"Cortada","description":"d","objective":"o","camera_brief":"Plano medio'
respuesta = "[" + entera + "," + cortada
salvadas = generador.parsear_json_desde_texto(respuesta, "paid")
comprobar("una respuesta cortada no se tira entera", len(salvadas) == 1, f"len={len(salvadas)}")
comprobar("se recupera la idea que SI cerro", salvadas and salvadas[0]["title"] == "Entera", str(salvadas[:1]))
comprobar("la idea a medias NO se inventa", all(i["title"] != "Cortada" for i in salvadas))

# Con varias enteras y la ultima cortada: se recuperan todas las enteras.
tres = ",".join([entera, entera, '{"title":"Media","description":"d"'])
completas = generador.parsear_json_desde_texto("[" + tres, "paid")
comprobar("se recuperan todas las completas", len(completas) == 2, f"len={len(completas)}")

# Una llave DENTRO de un valor de texto no cuenta como objeto: elGuion puede
# traer un ejemplo con corchetes y llaves, y no debe romper el conteo.
conllaves = '[{"title":"Con llaves","description":"usa {y} dentro","objective":"o"}]'
una = generador.parsear_json_desde_texto(conllaves, "paid")
comprobar("las llaves dentro de un valor no rompen nada", len(una) == 1, str(una[:1]))

# Comillas escapadas de verdad (backslash + comilla en el TEXTO): un valor que
# las lleve no debe partir el objeto ni hacer que se cuente una llave de mas.
escapado = r'[{"title":"Escapado","description":"dice \"{raro}\"","objective":"o"}]'
dos = generador.parsear_json_desde_texto(escapado, "paid")
comprobar("las comillas escapadas no parten el objeto", len(dos) == 1, str(dos[:1]))
comprobar("el valor escapado llega intacto", dos and dos[0]["description"] == 'dice "{raro}"', str(dos[:1]))

# Si NO hay ninguna idea completa, se sigue avisando: no se inventa nada.
solo_cortada = '[{"title":"Solo cortada","desc'
try:
    generador.parsear_json_desde_texto(solo_cortada, "paid")
    comprobar("sin ideas completas se avisa", False, "no lanzo error")
except RuntimeError:
    comprobar("sin ideas completas se avisa", True)

print()
if fallos == 0:
    print("TODO OK")
    sys.exit(0)
print(f"{fallos} FALLO(S)")
sys.exit(1)
if __name__ == "__main__":
    unittest.main()
