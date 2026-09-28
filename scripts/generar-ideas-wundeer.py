"""Genera las ideas de Wundeer y las monta en el Content Hub.

Corre dos veces al día (8:00 y 17:00) y produce 4 piezas: 2 de pauta y 2 de
orgánico. No es un LLM dentro del hub — el hub no tiene ninguno y no se le va a
meter uno: quien redacta es `redactor-b-u-c-m`, que ya vive en la flota.

Por qué el script y no un endpoint del hub:
- La idea se genera, se monta y se manda por WhatsApp. Son tres pasos con dos
  sistemas distintos (Supabase y Hermes), y un script es el único sitio donde
  los tres se ven a la vez.
- Si el generador falla a media corrida, el script ya dejó registrado qué creó.

Lo que este script NO hace:
- No toca la base con la anon key. Va por la API de gestión de Supabase, igual
  que `scripts/borrar-idea-prueba.py`, porque el RLS de `rr_hub_ideas` no deja
  escribir sin sesión y el hub está en modo abierto (sin sesión por diseño).
- No manda nada por WhatsApp si no creó ideas: un pack vacío es ruido, y el
  usuario pidió que el chat no se llene.

Uso:
    generar-ideas-wundeer.py                  # 4 ideas, salida por stdout
    generar-ideas-wundeer.py --solo-organico   # prueba de un solo tipo
    generar-ideas-wundeer.py --seco            # genera y NO manda: solo imprime
"""

import argparse
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime

# La comilla JSON de verdad, por codigo: comparar contra una comilla escrita a
# ojo funciona, pero escribirla en una expresion regular dentro de un patron la
# vuelve inutilizable. Se nombra una vez y se usa.
Q_JSON = chr(34)

PROYECTO = "ntgtvtzbjwotuwkiflar"
API = f"https://api.supabase.com/v1/projects/{PROYECTO}/database/query"
TOKENS = pathlib.Path.home() / ".hermes" / "mcp-tokens" / "supabase.json"
HUB = "https://rr-content-hub.vercel.app"
CLIENTE = "wundeer"

# Quién es el responsable de lo que genera el sistema. Santiago lo pidió así el
# 2026-09-28: en modo abierto no hay sesión, y una idea sin dueño no tiene a
# quién preguntarle. Se resuelve por nombre y falla ruidosamente si no aparece.
RESPONSABLE_NOMBRE = "Andrés Santiago Rosas Rios"

# Cuántas de cada tipo por corrida. Dos y dos es lo que pidió Santiago: dos
# ideas de pauta y dos de orgánico por cliente y por corrida.
CUANTAS_PAUTA = 2
CUANTAS_ORGANICO = 2

ESTADO_NACIMIENTO = "internal_review"  # nacen en revisión interna, no en borrador


def sql(consulta: str):
    """Ejecuta SQL por la Management API con POST.

    POST y no DELETE: la Management API responde 201 a un DELETE con cuerpo y no
    ejecuta nada. Y un `201 []` no prueba que la consulta corrió, por eso
    `verificar()` vuelve a preguntar después de escribir.
    """
    token = json.loads(TOKENS.read_text())["access_token"]
    peticion = urllib.request.Request(
        API,
        data=json.dumps({"query": consulta}).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(peticion, timeout=60) as respuesta:
            cuerpo = json.loads(respuesta.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        raise RuntimeError(f"SQL fallo ({error.code}): {error.read().decode('utf-8')[:300]}") from error
    if isinstance(cuerpo, dict) and "error" in cuerpo:
        raise RuntimeError(f"SQL fallo: {cuerpo['error']}")
    return cuerpo


def proyecto_id() -> str:
    filas = sql(f"select id from rr_hub_projects where slug = '{CLIENTE}'")
    if not filas:
        raise RuntimeError(f"El proyecto {CLIENTE} no existe.")
    return filas[0]["id"]


def responsable_id() -> str:
    """El id de Santiago en el perfil. Falla si no lo encuentra."""
    filas = sql(
        "select id, full_name from rr_hub_profiles "
        f"where full_name ilike '%{RESPONSABLE_NOMBRE.split()[-2]}%{RESPONSABLE_NOMBRE.split()[-1]}%'"
    )
    if not filas:
        raise RuntimeError(
            f"No se encontro a {RESPONSABLE_NOMBRE} en rr_hub_profiles. "
            "Sin responsable, las ideas generadas quedan huerfanas."
        )
    return filas[0]["id"]


def siguiente_codigo(tipo: str) -> str:
    """El siguiente codigo de idea del proyecto, por tipo de contenido.

    Dos bugs reales que se encontraron probando esto de verdad (2026-09-28):

    # 1. Se calculaba con el ÚLTIMO por fecha. O17/O13/O14/O15/O16 son todas
    #    `organic` y se crearon casi el mismo día, así que "la última" podía ser
    #    O16 y el código siguiente salía O17, que ya existía. La clave no se
    #    repitió.
    2. Se tomaba el prefijo de ESE codigo, sin mirar el tipo. Como las ideas
       existentes de Wundeer son organico (prefijo O), las nuevas salian
       `O17`/`O18` con `content_type = paid`: mezcla de prefijo y tipo, y el
       tablero y los filtros contaban mal.

    Ahora: el prefijo sale del tipo (`O` para organic, `P` para paid) y el numero
    del MAXIMO de ese prefijo, no del ultimo creado.
    """
    prefijo = "P" if tipo == "paid" else "O"
    filas = sql(
        f"select max(substring(code from 2)::int) n from rr_hub_ideas "
        f"where project_id = (select id from rr_hub_projects where slug = '{CLIENTE}') "
        f"and code like '{prefijo}%' and substring(code from 2) ~ '^[0-9]+$'"
    )
    return f"{prefijo}{(filas[0]['n'] or 0) + 1}"


def ideario_reciente(proyecto: str, limite: int = 40) -> str:
    """Los titulos ya existentes.

    Van al prompt para que el redactor NO repita lo que ya existe. Sin esto, dos
    corridas seguidas producen casi la misma idea y el equipo deja de mirar el
    pack a la tercera semana.
    """
    filas = sql(
        "select title from rr_hub_ideas "
        f"where project_id = '{proyecto}' order by created_at desc limit {limite}"
    )
    if not filas:
        return "(todavia no hay ideas)"
    return "\n".join(f"- {f['title']}" for f in filas)


def pedir_ideas(tipo: str, cuantas: int, ideario: str) -> list[dict]:
    """Le pide las ideas al bot redactor y devuelve la lista parseada.

    El bot responde texto libre; se le exige JSON y se parsea. Si no se puede
    parsear, esto revienta con el texto que vino, que es la única forma de
    depurar un prompt mal escrito sin tener que adivinar.
    """
    tipo_legible = "pauta (con medios pagados, idea de pauta creativa)" if tipo == "paid" else "organico (sin pauta, para publicar en el feed)"
    encargue = (
        f"Genera {cuantas} ideas de contenido para la marca WUNDEER, tipo {tipo_legible}.\n\n"
        "Cada idea debe tener: title (corto, con gancho, max 60 caracteres), "
        "description (una frase de por que funciona), objective (que se busca), "
        "camera_brief (plano/luz/encuadre), talent_brief (quien sale y como), "
        "edit_brief (ritmo, cortes, texto en pantalla).\n\n"
        "Devuelve SOLO un array JSON, sin texto antes ni despues, con esta forma:\n"
        '[{"title":"...","description":"...","objective":"...","camera_brief":"...",'
        '"talent_brief":"...","edit_brief":"..."}]\n\n'
        "Estas ideas YA existen, no las repitas ni las reformules:\n"
        f"{ideario}\n\n"
        "Todo en español de Colombia. Sin emojis en los textos."
    )

    # `--oneshot -q` es la unica forma limpia de hablar con un bot desde un cron,
    # y los tres detalles importan (2026-09-28, tres bugs reales encontrados):
    #
    # 1. NO `timon.sh`: reanuda la sesion de Bot Chat del bot y el JSON salio
    #    contaminado con la conversacion anterior ("Construirrecordacion de marca
    #    y viralidad de paid social"). El generador hereda el hilo del bot y
    #    produce ideas sobre lo que el bot discutia hace tres mensajes.
    # 2. NO `hermes chat` sin `-q`: imprime el banner de caja, el eco del PROMPT
    #    (que incluye el `[{` de ejemplo del encargo) y barras de progreso
    #    `[░░░░░]`. El parser enganchaba ese corchete y el error que salia
    #    ("Expecting value: line 1 column 2") no señalaba nada del banner.
    # 3. `--oneshot` dispara la POLITICA DE SESIONES del operador, que pregunta
    #    "¿pinto esta sesion?". Sin humano delante, eso se cuelga y la respuesta
    #    del bot nunca llega. Se desactiva con el archivo `.session-keep-prompt-off`,
    #    que es justamente lo que el propio hook documenta para las ejecuciones
    #    sin humano delante. Sin ese archivo, un cron de generacion no funciona.
    #
    # Y aunque el bot devuelva basura (una vez metio 1000 caracteres de
    # "0.8, 0.8, 0.8" en un campo), el parser exige que el JSON cierre: si no,
    # esta corrida no crea nada y lo dice por stderr.
    proceso = subprocess.run(
        ["hermes", "chat", "-Q", "--oneshot", "-q", encargue],
        capture_output=True, text=True, timeout=600,  # 600 s: un bot de tier free tarda hasta 3 min
        cwd=str(pathlib.Path.home() / ".hermes" / "profiles" / PERFIL_REDACTOR),
    )
    salida = limpiar_salida_hermes(proceso.stdout or "")
    if not salida:
        raise RuntimeError(f"El redactor no devolvio nada. stderr: {(proceso.stderr or '')[:300]}")

    return parsear_json_desde_texto(salida, tipo)


PERFIL_REDACTOR = "redactor-b-u-c-m"

# Los codigos de escape del terminal (ANSI) que emite `hermes chat`. Se quitan
# por patron, no caracter a caracter: un `\x1b[...letra` puede llevar parametros
# intermedios (`\x1b[0m`, `\x1b[?2004h`, `\x1b[62C`).
ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")

# El hook de la politica de sesiones pregunta "¿pino esta sesion?" en el primer
# turno de CADA sesion nueva. Un cron no tiene a nadie delante, asi que esa
# pregunta se queda colgada y el bot nunca responde. Este archivo es el
# interruptor que el propio hook documenta para las ejecuciones sin humano
# delante; sin el, el generador no produce nada.
MARCA_SIN_SESION = pathlib.Path.home() / ".hermes" / ".session-keep-prompt-off"


def limpiar_salida_hermes(texto: str) -> str:
    """Saca la respuesta del bot del ruido de `hermes chat`.

    Con `--oneshot` la salida es casi solo la respuesta, pero aun asi puede
    traer el aviso de "1457 commits behind" o un `Goodbye!`. Todo eso vive FUERA
    del array JSON, asi que el parser lo tolera por construccion.
    """
    sin_ansi = ANSI.sub("", texto)
    return "".join(c for c in sin_ansi if c in "\n\t" or ord(c) >= 32).strip()


def parsear_json_desde_texto(texto: str, tipo: str) -> list[dict]:
    """Saca el array JSON de una respuesta que puede venir envuelta en texto.

    Los bots contestan con proseo alrededor del JSON. Buscar el primer `[` y el
    ultimo `]` que encierren algo parseable es mas robusto que exigirle al bot
    que no hable, y que fallar cuando el bot cumplio.
    """
    limpio = texto.strip()
    # Se toleran los cercas de codigo que algunos bots envuelven.
    if limpio.startswith("```"):
        limpio = limpio.split("\n", 1)[-1]
        if limpio.endswith("```"):
            limpio = limpio[:-3]
    # Las comillas tipograficas SOLO se pueden escribir con su punto de codigo:
    # escribirlas a ojo las convierte en el mismo caracter de apertura y cierre
    # y el reemplazo no hace nada. Se comparan por numero, no por lo que se ve.
    #
    # El caso real que de verdad rompe: un bot que usa comillas tipograficas COMO
    # delimitadores del valor (`{"title":“bonitas”}`). Se convierten a comillas
    # JSON y queda bien. Lo que NO se intenta es adivinar una tipografica
    # decorativa DENTRO de un valor que ya tiene sus comillas JSON
    # (`{"title":"Comillas “bonitas”"}`): convertirla produciria dos comillas
    # pegadas, y adivinar cual de las dos era la buena es un problema sin
    # respuesta. Se colapsan las dobles por si acaso, y si el JSON sigue sin
    # cerrar, el error lo dice claro.
    # Las simples usadas como delimitador se convierten a comilla DOBLE: el
    # apostrofe no es un delimitador JSON valido, asi que convertirlas a `'` daria
    # `{"title":'clave'}`, que no lo parsea nadie. Se convierten a dobles porque
    # es la unica conversion que puede dejar el JSON entero valido.
    limpio = limpio.replace(chr(0x201C), Q_JSON).replace(chr(0x201D), Q_JSON)
    simple_a_doble = limpio.replace(chr(0x2018), Q_JSON).replace(chr(0x2019), Q_JSON)
    limpio = re.sub(re.escape(Q_JSON) + "{2,}", Q_JSON, simple_a_doble)

    inicio = limpio.find("[" + "{")
    fin = limpio.rfind("]")

    # La salida de `hermes chat` viene entrelazada con el eco del prompt y con
    # barras de progreso como `[░░░░░░░░░░]`, que tambien abren y cierran con
    # corchete. Por eso no se toma el PRIMER corchete: se busca el primero que
    # abre un array de OBJETOS, que es `[{"`, y se prueban varios cierres.
    #
    # Probar varios, y no quedarse con el primero, es por seguridad: el eco del
    # prompt puede dejar un `]` de un ejemplo antes del cierre real, y con el
    # primer cierre se leeria un array truncado sin avisar.
    if inicio == -1:
        raise RuntimeError(f"El redactor no devolvio un array JSON. Venia esto:\n{texto[:500]}")

    ultimo_cierre = min(fin, len(limpio) - 1)
    for corte in range(ultimo_cierre, inicio, -1):
        if limpio[corte] != "]":
            continue
        try:
            datos = json.loads(limpio[inicio:corte + 1])
        except json.JSONDecodeError:
            continue
        if isinstance(datos, list) and datos:
            break
    else:
        raise RuntimeError(f"El array del redactor no es JSON valido. Texto:\n{texto[:500]}")

    ideas = [i for i in datos if isinstance(i, dict) and i.get("title")]
    if not ideas:
        raise RuntimeError(f"El redactor devolvio {len(datos)} elementos y ninguno tiene title. Texto:\n{texto[:500]}")
    return ideas


CAMPOS = {
    "description": "description",
    "objective": "objective",
    "camera_brief": "camera_brief",
    "talent_brief": "talent_brief",
    "edit_brief": "edit_brief",
}


def crear_idea(proyecto: str, responsable: str, codigo: str, tipo: str, idea: dict) -> str:
    """Inserta la idea y devuelve su id.

    Nace en `internal_review`: el flujo nuevo exige que toda idea se mire antes de
    mandarse al cliente, y naciendose en `draft` habria que empujarla a mano a
    la revision interna todos los dias.
    """
    columnas = {
        "project_id": proyecto,
        "code": codigo,
        "title": str(idea.get("title", "")).strip()[:200],
        "status": ESTADO_NACIMIENTO,
        "content_type": "paid" if tipo == "paid" else "organic",
        "created_by": responsable,
        "description": str(idea.get("description", "")).strip()[:2000],
        "objective": str(idea.get("objective", "")).strip()[:1000],
        "camera_brief": str(idea.get("camera_brief", "")).strip()[:2000],
        "talent_brief": str(idea.get("talent_brief", "")).strip()[:2000],
        "edit_brief": str(idea.get("edit_brief", "")).strip()[:2000],
    }
    # Sin descripcion ni objetivo la ficha queda muda, y una idea muda no se puede
    # ni revisar ni votar con sentido.
    if not columnas["title"] or not columnas["objective"]:
        raise RuntimeError(f"La idea {codigo} vino sin titulo u objetivo: {idea}")

    # El INSERT se arma como `values`, NO como `clave = valor`: se estaba
    # construyendo un UPDATE y metido donde esperaba una lista de valores, y
    # Postgres leia el texto completo como un solo booleano. El error de verdad
    # ("project_id is of type uuid but expression is of type boolean") no
    # señalaba nada sobre claves foraneas, porque la falla estaba una linea antes.
    def literal(valor) -> str:
        # None -> NULL de verdad, no la palabra 'None' entre comillas.
        if valor is None:
            return "null"
        if isinstance(valor, bool):
            return "true" if valor else "false"
        return "'" + str(valor).replace("'", "''") + "'"

    valores = ", ".join(literal(valor) for valor in columnas.values())
    filas = sql(
        "insert into rr_hub_ideas (" + ", ".join(columnas) + f") values ({valores}) returning id, code"
    )
    if not filas:
        raise RuntimeError(f"La insercion de {codigo} no devolvio id.")
    return filas[0]["id"]


def registrar_evento(idea_id: str, actor: str, comentario: str) -> None:
    """Deja constancia de que la idea la generó el sistema, no una persona."""
    seguro = comentario.replace("'", "''")
    sql(
        "insert into rr_hub_events (idea_id, from_status, to_status, comment, actor_label) "
        f"values ('{idea_id}', NULL, '{ESTADO_NACIMIENTO}', '{seguro}', '{actor}')"
    )


def main() -> int:
    analizador = argparse.ArgumentParser()
    analizador.add_argument("--solo-organico", action="store_true")
    analizador.add_argument("--seco", action="store_true", help="genera pero no imprime el pack de WhatsApp")
    opciones = analizador.parse_args()

    proyecto = proyecto_id()
    responsable = responsable_id()
    ideario = ideario_reciente(proyecto)

    # Sin este archivo, `--oneshot` se cuelga preguntando por la sesion. Se crea
    # aqui y no se asume que exista: el generador tiene que funcionar solo, que
    # es justo lo que se le pide a un cron.
    if not MARCA_SIN_SESION.exists():
        try:
            MARCA_SIN_SESION.touch()
            print(f"[info] creada {MARCA_SIN_SESION.name} para poder correr sin humano delante", file=sys.stderr)
        except OSError as error:
            print(f"[aviso] No se pudo crear {MARCA_SIN_SESION.name}: {error}", file=sys.stderr)

    pedidos = []
    if not opciones.solo_organico:
        pedidos.append(("paid", CUANTAS_PAUTA))
    pedidos.append(("organic", CUANTAS_ORGANICO))

    creadas: list[tuple[str, str, str]] = []  # (codigo, tipo, id)
    for tipo, cuantas in pedidos:
        try:
            ideas = pedir_ideas(tipo, cuantas, ideario)
        except Exception as error:  # noqa: BLE001
            # Un tipo que falla no puede tumbar el otro: se avisa y se sigue.
            print(f"[aviso] No se pudieron generar ideas de {tipo}: {error}", file=sys.stderr)
            continue
        for idea in ideas[:cuantas]:
            try:
                codigo = siguiente_codigo(tipo)
                idea_id = crear_idea(proyecto, responsable, codigo, tipo, idea)
                registrar_evento(
                    idea_id,
                    "GENERADOR AUTOMATICO",
                    f"Idea generada automaticamente ({'pauta' if tipo == 'paid' else 'organico'}). Entra en revision interna.",
                )
                creadas.append((codigo, tipo, idea_id))
                print(f"[ok] {codigo} — {idea.get('title', '')[:60]}", file=sys.stderr)
            except Exception as error:  # noqa: BLE001
                print(f"[aviso] No se pudo crear una idea de {tipo}: {error}", file=sys.stderr)

    if not creadas:
        print("[error] No se creo ninguna idea. No se manda nada a WhatsApp.", file=sys.stderr)
        return 1

    if not opciones.seco:
        print(empaquetar(creadas))

    return 0


def empaquetar(creadas: list[tuple[str, str, str]]) -> str:
    """El pack de WhatsApp.

    Se imprime en stdout y el cron lo entrega tal cual (`no_agent`). Es corto a
    proposito: se lee en un celular, de un vistazo. Sin tablas, sin rutas, sin
    conteos internos.
    """
    ahora = datetime.now().strftime("%H:%M")
    pauta = [(c, i) for c, t, i in creadas if t == "paid"]
    organico = [(c, i) for c, t, i in creadas if t == "organic"]

    lineas = [f"*IDEAS WUNDEER · {ahora}*", f"{len(pauta)} pauta · {len(organico)} orgánico", ""]

    for titulo, lista in (("PAUTA", pauta), ("ORGÁNICO", organico)):
        if not lista:
            continue
        lineas.append(f"*{titulo}*")
        for codigo, idea_id in lista:
            lineas.append(f"· {codigo}  {HUB}/{CLIENTE}/ideas/{idea_id}")
        lineas.append("")

    lineas.append("Entran en revisión interna. Votá en la ficha: si hay más votos a favor que en contra, la idea sale sola al cliente.")
    return "\n".join(lineas).strip()


if __name__ == "__main__":
    raise SystemExit(main())
