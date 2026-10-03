# Votación: perfil de votante y tiempo real (2026-10-03)

Dos arreglos medidos en producción, con lo que costó encontrar cada uno.

## 1. `SOLO LECTURA` no era un botón

En la cabecera de `workspace-shell.tsx` había un `<span>` con ese texto. No
hacía nada y decía una cosa falsa: que no se podía hacer nada. Lo que no se podía
era **escribir** en el tablero. La votación interna sí, y es justo lo que el
equipo viene a hacer en la reunión.

La razón por la que no se votaba era esa, no la UX de los botones: había que
entrar con un correo de la lista blanca del equipo (`is_team_member` +
`is_active`), y con el hub en puerta por código la mayoría de las veces no había
sesión. El sistema funcionaba y nadie lo tocaba.

**El arreglo**: selector de perfil. Se elige con qué nombre del equipo se emite el
voto, se recuerda en `localStorage` (`rr_perfil_votante`) y se cambia entre ideas.

Lo que NO abre:

- El token del navegador sigue siendo la clave del upsert
  (`UNIQUE (idea_id, voter_token)`): una sola máquina no emite los votos de tres.
- El correo se comprueba contra `rr_hub_profiles`, no contra el cuerpo. Se manda
  en **`voterProfile`**, nunca en `voterEmail`: ese campo existe para que la ruta
  lo ignore, y escribir el de otra persona sería votar en su nombre.
- El equipo sale de `rr_hub_profiles`, no de `rr_hub_presencia`. Presencia dice
  quién se conectó: alguien del equipo que nunca ha entrado desaparecería del
  selector. MEDIDO: 18 personas activas.

## 2. El contador se quedaba viejo

Se leía al pintar la página (Server Component). MEDIDO: votaba una persona y las
demás seguían viendo el número anterior hasta recargar. Se debatía una idea "con 2
sí" mientras en otra pantalla ya había 3.

Ahora `GET /api/workspace/votos?proyecto=` + `useVotosEnVivo`:

- 10 s de intervalo. Solo repinta si el número **cambió** (`if (igual) return`),
  si no parpadea.
- Con la pestaña oculta no pregunta: 18 pestañas del equipo en segundo plano es
  gasto sin información.
- El voto propio se pinta sobre el del servidor (`propio?.aFavor ?? conteo.aFavor`).
  Poner el del servidor muestra un rebote al número anterior: peor que esperar.

## 3. Lo que solo aparece si abres la ficha

`vote-quick.tsx` (el botón de la **tarjeta** del tablero) no mandaba perfil. El
clic se registraba y no pasaba nada en la base. `idea-voting.tsx` (la ficha) sí lo
mandaba. Dos caminos distintos al mismo endpoint, y basta con que uno se quede
atrás. También se conectó al hook: la ficha se actualizaba sola y la tarjeta no.

## 4. `rr_hub_votes` no tiene `project_id`

Solo `idea_id`. Filtrar por `project_id` **no da error**: PostgREST lo ignora y
devuelve los votos de OTROS clientes. Para acotar por cliente hay que resolver el
proyecto cruzando por la idea.

## 5. `full_name`, no `nombre`

`rr_hub_profiles` tiene `full_name`. Pedir `nombre` devuelve `{}` **sin error** y
se pinta como una lista de nombres en blanco.

## Cómo se comprueba

Los tests se validan revirtiendo el cambio que vigila, no solo en verde. En este
caso, cuatro mutaciones:

| mutación | fallos |
|---|---|
| perfil ignorado en el servidor | 2 |
| preguntar con la pestaña oculta | 1 |
| congelar el conteo de la tarjeta | 1 |
| devolver el botón a un `<span>` | 1 |

### Trampa de aserto

Un aserto que acotaba el `setInterval` con `hook.slice(indexOf('setInterval'),
indexOf('addEventListener'))` **no fallaba** al quitar el guard del intervalo: el
handler de `visibilitychange` también lo tiene y quedaba dentro del slice. Hay
que acotar hasta el handler siguiente (`const alVolver`), no hasta el siguiente
`addEventListener`.

Igual con dos enlaces a la misma ruta (la barra y el botón): el regex con `.*?`
cruzaba de uno al otro y el botón muerto quedaba tapado. Hay que usar
`lastIndexOf` para el del botón.