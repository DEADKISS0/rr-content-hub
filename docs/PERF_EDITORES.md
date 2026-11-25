# Rendimiento de los editores del Hub

Medido el 2026-11-25 en Chromium contra el servidor local del Hub. Las cifras de red varían entre corridas; sirven para comparar el mismo flujo, no como SLA.

## Antes

- RR Imagen: WASM 32.892.256 B; 14,62 MB Brotli en producción.
- RR Motion: WASM 48.823.364 B; 14,14 MB Brotli en producción.
- Producción revalidaba todos los assets (`max-age=0, must-revalidate`).
- RR Motion pedía JavaScript y después WASM (cascada).
- La CSP global bloqueaba la compilación de WebAssembly.
- RR Motion conservaba una custom section `name` de 7.407.109 B.

## Cambios

1. CSP exclusiva de `/editors/*` con `wasm-unsafe-eval`, sin abrir `unsafe-eval`.
2. Caché inmutable de WASM/glue versionado; HTML siempre revalidado.
3. Preload paralelo de JavaScript y WASM en RR Motion.
4. Eliminación de la sección `name` del WASM de RR Motion con `scripts/strip-wasm-names.ts`.

## Después

- RR Motion WASM: 41.416.250 B (−7.407.114 B).
- Arranque en caliente observado: RR Motion 677 ms → 365 ms.
- Primera apertura observada tras los cambios: RR Motion 2.101 ms; RR Imagen 1.162 ms en caliente.
- Pruebas de regresión: 733 unitarias, typecheck, lint, build y dos recorridos Playwright.

## Ronda 2 (2026-11-25)

- Precarga del WASM al pasar el cursor o enfocar «EDITAR FOTO»/«EDITAR VIDEO» en el menú Estudio: la descarga de ~14 MB empieza antes del clic. Se hace con `requestIdleCallback` y una sola vez por editor, así que no penaliza a quien no abre el estudio.
- `fetchpriority="high"` en el preload del WASM de RR Imagen, antes solo lo tenía RR Motion.
- Recorrido E2E nuevo que comprueba la precarga al anticipar el clic.

Medición en producción tras la ronda 1, con caché caliente: RR Imagen WASM 253 ms y RR Motion listo en 391 ms. En frío Vercel sirve 14,6 MB (imagen) y 13,4 MB (video) comprimidos con Brotli; el service worker no pre-cachea los binarios a propósito.

## No hecho

- No se reconstruyó Rust ni se desactivó HEIF/codecs: las fuentes entregadas son instantáneas sin `.git` y el README dice que reconstruirlas no está verificado; además RR Motion ya desactiva Rayon solo para WASM. Cambiar codecs exige validar edición y exportación reales.
- No se sirve Zstd:reduce ~18% frente a Brotli, pero Vercel no lo negocia y lo devuelve sin comprimir (verificado), así que empeoraría la carga.
- No se añadieron duplicados `.br` al repo: aumenta el payload y puede superar límites de despliegue.
