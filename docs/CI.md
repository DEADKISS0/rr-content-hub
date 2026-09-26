# El portero: tests y CI del hub

> Corte: 2026-09-26. Verificado corriendo los comandos, no copiado de la doc.

## Por qué existe

El commit `08b7cd9` llegó a `main` con JSX roto y dejó **cuatro deploys de producción en
ERROR** sin que nadie lo notara. Hasta hoy el repo no tenía un solo test ni workflow.
Esto es el portero que faltaba.

## Qué corre, en orden

```bash
npm test                 # 35 tests, 3 archivos — lógica pura, sin base de datos
npx tsc --noEmit         # tipos
npm run lint             # eslint
npm run build            # el build real de Next
npm run test:e2e         # 6 recorridos de lectura en un navegador real (necesita dev vivo)
npm run verify           # test + tipos + lint en un solo comando
```

`.github/workflows/ci.yml` hace los cuatro primeros pasos en cada push a `main` y en cada
PR. El build corre con variables de Supabase **de mentira**: CI nunca toca datos reales, y
las páginas que consultan caen a su estado vacío.

## Qué está cubierto (y por qué eso y no otra cosa)

| Archivo | Qué fija |
|---|---|
| `src/lib/flow.test.ts` | Cada estado vive en **una sola** columna y **una sola** fase (una pieza nunca puede caer en la cola de otra fase); el cliente no puede mover un borrador; todo movimiento ofrecido está explicado; `daysSince` no inventa fechas. |
| `src/lib/reference.test.ts` | Qué referencias dan miniatura real (Drive, YouTube, imagen directa) y cuáles **no** (Instagram, TikTok): los enlaces que rompían los previews. |
| `src/lib/roadmap.test.ts` | Cuentas de días, avance 0–100 sin salirse del rango, y el estado cerrado / en curso / pendiente de cada tramo del plan. |
| `e2e/hub.spec.ts` | Las invariantes **visibles**: una sola acción para crear en el tablero, la cola ordenada por antigüedad, la acción de la ficha dentro del primer pantallazo, las tres pistas del roadmap con avance distinto, los avisos honestos de las pantallas sin base y el panel de administración sin fuga de correos. |

`reference.ts` se extrajo del componente justamente para poder testearlo: la regla vive en
`lib/`, el componente solo pinta.

## Los e2e son de lectura y locales

`e2e/hub.spec.ts` **no escribe nada**: navega y lee. Una prueba que mueva una pieza estaría
tocando datos de clientes en el Supabase de producción, que es el único que existe.

Corren contra un servidor local (`reuseExistingServer`, así que reutilizan el que ya estés
usando en el puerto 3100) y con una ventana de **1280×720**, tamaño de portátil real. Los
dos fallos que ya cazaron solo se ven a esa altura:

- La acción de la ficha caía en `y≈736`: **debajo del pliegue** en un portátil de 720 px.
  Con una ventana alta parecía correcta. Se subió la acción arriba del preview (`y≈485`).
- El medidor de las tres pistas del roadmap se buscaba en la tarjeta de estado, donde no
  está: vive en `nav[aria-label="Pistas del roadmap"]`.

**No van en CI** (todavía): el runner no tiene acceso a los datos reales y el hub no tiene
entorno de preview con base propia. Ponerlos en CI con datos de mentira los volvería
decorativos. Falta decidir: base de preview de Supabase o datos sembrados por test.

## Pendiente de este CI

- **Su primera corrida real no está verificada**: se escribió desde esta máquina, que no
  tiene runner de GitHub. Los pasos sí se corrieron en local y pasan. Al pushear, mirar la
  primera ejecución.
- Bloquear el merge en GitHub (branch protection sobre `main`): es un ajuste del repo, no
  del código.
- e2e de **escritura** (mover una pieza por fase y rol) contra un entorno de preview —
  nunca contra producción. Ver `references/pipeline-e2e.md` de la skill.
- Aviso (sin bloquear) cuando producción lleva X horas sin un deploy READY.

## Ojo con este equipo

Aquí `npm` está configurado con `omit=dev`, así que **no instala devDependencies** y
`npx` las resuelve desde su caché. Eso hace que `npx vitest` corra una copia que no
conoce el alias `@` del proyecto y falle. Para correr los tests en esta máquina:

```bash
npm install --include=dev      # una vez
./node_modules/.bin/vitest run # o `npm test`, ya con el árbol completo
```

Los navegadores de Playwright ya están en el caché (`~/.cache/ms-playwright`), así que no
hace falta descargar chromium otra vez.
