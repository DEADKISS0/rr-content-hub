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

## No hecho

- No se reconstruyó Rust ni se desactivó HEIF/codecs: requiere benchmark de funcionalidad y rendimiento de edición/exportación.
- No se añadieron duplicados `.br` al repo: aumenta el payload y puede superar límites de despliegue.
