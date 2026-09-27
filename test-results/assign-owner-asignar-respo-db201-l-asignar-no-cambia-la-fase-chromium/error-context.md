# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: assign-owner.spec.ts >> asignar responsable >> no promete una transición de rol: asignar no cambia la fase
- Location: e2e/assign-owner.spec.ts:28:7

# Error details

```
Test timeout of 45000ms exceeded.
```

```
Error: page.goto: Test timeout of 45000ms exceeded.
Call log:
  - navigating to "http://localhost:3223/wundeer/ideas/27fe6119-b7b6-4409-8aeb-0ae419d574ae", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - link "RR Aliados RR / WUNDEER" [ref=e5] [cursor=pointer]:
          - /url: /wundeer
          - img "RR Aliados" [ref=e6]
          - generic [ref=e7]: RR / WUNDEER
        - button "Compactar el menú" [expanded] [ref=e8]
      - navigation "Menú principal" [ref=e12]:
        - link "EL TABLERO Todo el trabajo, de un vistazo" [ref=e13] [cursor=pointer]:
          - /url: /wundeer
          - generic [ref=e18]:
            - strong [ref=e19]: EL TABLERO
            - generic [ref=e20]: Todo el trabajo, de un vistazo
        - link "LAS PIEZAS La lista completa" [ref=e21] [cursor=pointer]:
          - /url: /wundeer/ideas
          - generic [ref=e27]:
            - strong [ref=e28]: LAS PIEZAS
            - generic [ref=e29]: La lista completa
        - link "ESPERA RESPUESTA Lo que hay que decidir" [ref=e30] [cursor=pointer]:
          - /url: /wundeer/aprobaciones
          - generic [ref=e35]:
            - strong [ref=e36]: ESPERA RESPUESTA
            - generic [ref=e37]: Lo que hay que decidir
        - link "EL PLAN Cuánto falta para el final" [ref=e38] [cursor=pointer]:
          - /url: /wundeer/roadmap
          - generic [ref=e44]:
            - strong [ref=e45]: EL PLAN
            - generic [ref=e46]: Cuánto falta para el final
        - group [ref=e47]:
          - generic "VER MÁS" [ref=e48] [cursor=pointer]
      - paragraph [ref=e52]: RR CONTENT HUB · WUNDEERDatos vivos de Supabase
    - generic [ref=e53]:
      - banner [ref=e54]:
        - generic [ref=e55]:
          - link "WUNDEER · TODO EL CONTENIDO EN UN LUGAR" [ref=e56] [cursor=pointer]:
            - /url: /wundeer
          - link "NUEVA PIEZA" [ref=e58] [cursor=pointer]:
            - /url: /wundeer/ideas/nueva
      - main [ref=e61]:
        - generic [ref=e63]:
          - navigation "Ruta de navegación" [ref=e64]:
            - link "WUNDEER" [ref=e66] [cursor=pointer]:
              - /url: /wundeer
            - generic [ref=e67]:
              - generic [aria-hidden] [ref=e68]: /
              - link "BANCO" [ref=e69] [cursor=pointer]:
                - /url: /wundeer/ideas
            - generic [ref=e70]:
              - generic [aria-hidden] [ref=e71]: /
              - generic [ref=e72]: O10
          - generic "IDEA APROBADA — Dirección aprobada. Arranca la escritura del guion." [ref=e73]: IDEA APROBADA
        - generic [ref=e77]:
          - generic [ref=e78]:
            - generic [ref=e79]:
              - paragraph [ref=e80]: O10 · ORGÁNICO · Lifestyle Clean
              - heading "Silueta al atardecer" [level=1] [ref=e81]
              - paragraph [ref=e82]: "Silueta fija contra el atardecer sosteniendo un objeto elongado, con el wordmark en overlay (formato tipo Jacquemus). Pilar: Lifestyle Clean."
              - generic [ref=e83]:
                - generic [ref=e84]: FOTO
                - generic [ref=e89]: Lifestyle Clean
                - generic [ref=e94]: 15 DÍAS SIN MOVERSE
                - generic [ref=e98]: FICHA COMPLETA
              - generic [ref=e101]:
                - generic [ref=e106]:
                  - paragraph [ref=e107]: IDEA APROBADA
                  - paragraph [ref=e108]: Dirección aprobada. Arranca la escritura del guion.
                - generic [ref=e109]:
                  - generic [ref=e110]:
                    - generic "IDEA · Se propone y se decide" [ref=e111]: IDEA
                    - generic "GUIÓN · Se escribe y se aprueba" [ref=e112]: GUIÓN
                    - generic "RODAJE · Se graba y se sube el crudo" [ref=e113]: RODAJE
                    - generic "EDICIÓN · Se monta y se aprueba" [ref=e114]: EDICIÓN
                    - generic "PUBLICACIÓN · Se publica y se cierra" [ref=e115]: PUBLICACIÓN
                  - generic [ref=e116]: "AHORA ACTÚA: CREATIVA"
            - generic [ref=e118]:
              - paragraph [ref=e119]: "[TU SIGUIENTE ACCIÓN]"
              - heading "Qué hacer ahora." [level=2] [ref=e120]
              - generic [ref=e122]:
                - generic [ref=e123]:
                  - paragraph [ref=e124]: "[DÓNDE ESTÁ ESTA PIEZA]"
                  - generic [ref=e125]:
                    - generic [aria-hidden] [ref=e126]: ✓
                    - heading "IDEA APROBADA" [level=3] [ref=e127]
                  - paragraph [ref=e128]: Dirección aprobada. Arranca la escritura del guion.
                  - paragraph [ref=e129]:
                    - text: Ahora le toca a
                    - strong [ref=e130]: OWNER o CREATIVA
                    - text: .
                - generic [ref=e131]:
                  - generic [ref=e132]: // NOTA PARA EL SIGUIENTE RELEVO (OPCIONAL)
                  - textbox "// NOTA PARA EL SIGUIENTE RELEVO (OPCIONAL)" [ref=e133]:
                    - /placeholder: Contexto, confirmaciones o cambios relevantes…
                - group "Movimientos disponibles" [ref=e134]:
                  - button "INICIAR GUIÓN → deja la pieza en GUIÓN EN CURSO · le tocará a CREATIVA" [ref=e136]:
                    - generic [ref=e137]: INICIAR GUIÓN
                    - generic [ref=e138]: → deja la pieza en GUIÓN EN CURSO · le tocará a CREATIVA
                - generic [ref=e139]:
                  - paragraph [ref=e140]: "[DESPUÉS DE ESTO]"
                  - paragraph [ref=e141]:
                    - text: La pieza queda en
                    - strong [ref=e142]: GUIÓN EN CURSO
                    - text: y el siguiente relevo es
                    - strong [ref=e143]: CREATIVA
                    - text: . Se está escribiendo el guion de la pieza.
                - group [ref=e144]:
                  - generic "VER TRAZABILIDAD (1)" [ref=e145] [cursor=pointer]
                  - list [ref=e146]:
                    - listitem [ref=e147]:
                      - paragraph [ref=e148]: 11/09/2026, 8:15 p. m. · Modo colaborativo · OWNER
                      - paragraph [ref=e149]: "[IDEA APROBADA]"
                      - paragraph [ref=e150]: El cliente aprobó la idea.
          - generic [ref=e151]:
            - generic [ref=e152]:
              - generic [ref=e154]:
                - generic [ref=e155]:
                  - paragraph [ref=e156]: "[REFERENCIA VISUAL · GOOGLE DRIVE]"
                  - link "ABRIR ORIGINAL ↗" [ref=e157] [cursor=pointer]:
                    - /url: https://drive.google.com/file/d/1eyp_gF4azD4NoW-w-hOtMKB1Tze0XyXk/view?usp=drivesdk
                - generic [ref=e158]:
                  - iframe [ref=e160]:
                    - application:
                      - iframe [aria-hidden] [ref=f1e1]
                      - region
                      - generic "Se está mostrando el lector." [ref=f1e2]:
                        - generic "Mostrando Silueta al atardecer .mp4"
                        - main [ref=f1e4]:
                          - generic [ref=f1e8]:
                            - status "Cargando" [ref=f1e10]
                            - generic [ref=f1e45]:
                              - generic:
                                - generic:
                                  - generic:
                                    - button "Reproducir con combinación de teclas k"
                                    - tooltip [aria-hidden]: Reproducir (k)
                                - img "Obtener vista previa de la imagen"
                              - generic "Obtener vista previa de la imagen":
                                - generic:
                                  - generic:
                                    - button "Reproducir con combinación de teclas k"
                                    - tooltip [aria-hidden]: Reproducir (k)
                              - iframe [ref=f1e47]
                        - button "Ventana emergente" [ref=f1e50] [cursor=pointer]
                      - generic [ref=f1e52]: Mostrando Silueta al atardecer .mp4
                  - generic [ref=e161]:
                    - heading [level=3] [ref=e162]:
                      - text: ¿Por qué
                      - emphasis [ref=e163]: esta referencia?
                    - generic [ref=e164]:
                      - generic [ref=e165]:
                        - term [ref=e166]: // INTENCIÓN
                        - definition [ref=e167]: "Generar un momento de marca puro sin venta directa: solo mood y reconocimiento. Un formato wallpaper que funciona por repetición en el feed."
                      - generic [ref=e168]:
                        - term [ref=e169]: // CÁMARA
                        - definition [ref=e170]: "PLANO: general fijo en trípode, cero movimiento de cámara. UBICACIÓN: azotea, terraza o punto alto sin obstrucciones al horizonte, hora dorada (30-40 min antes del ocaso); fondo solo cielo y silueta. LUZ: contraluz total, sol justo detrás del talento; apoyo artificial muy tenue opcional. Se graban 3-4 tomas variando el ángulo del brazo/prop para elegir la mejor silueta en edición. Dos versiones: con gancho de madera (prenda colgada en alto) y sin objeto (silueta limpia)."
                      - generic [ref=e171]:
                        - term [ref=e172]: // TALENTO
                        - definition [ref=e173]: "VESTUARIO: prenda ancla de silueta reconocible a contraluz; importa más el corte que el color (todo se lee en negro). Pantalón recto + superior de hombros marcados (oversized lee bien). ACCIÓN: de pie, quieto, sosteniendo el prop en alto con un solo brazo, o sin nada en las manos (el peso visual lo lleva la postura). Sin props con marca visible, sin objetos que distraigan del gesto."
                      - generic [ref=e174]:
                        - term [ref=e175]: // EDICIÓN
                        - definition [ref=e176]: "HOOK: la silueta + wordmark aparecen de inmediato, sin introducción (el hook es la estética). TEXTO: solo tipografía — logo Wundeer centrado, fijo desde el segundo 0; nada más en pantalla. AUDIO: ambiente de viento/atardecer muy bajo, o silencio con instrumental mínima. CAPTION: 'Esenciales elevados.' CTA: ninguno (vende marca, no producto). Duración 6-8s en loop."
              - generic [ref=e177]:
                - generic [ref=e178]:
                  - paragraph [ref=e179]: "[GUIÓN EDITABLE]"
                  - button "✎ EDITAR GUION" [ref=e180]
                - heading "El plan de la pieza." [level=2] [ref=e181]
                - generic [ref=e182]: "GUION — SILUETA AL ATARDECER (6-8s loop) HOOK: silueta + wordmark inmediatos, sin introducción. ESCENA 1 (0-8s) · Plano general fijo, cámara en trípode - Talento de pie, quieto, sosteniendo el prop en alto con un solo brazo. - Cero movimiento de cámara: la producción está en la composición y la luz. NOTA DE PRODUCCIÓN - Una sola toma estática pensada para loop perfecto. - Grabar 3-4 tomas variando ligeramente el ángulo del brazo/prop. TEXTO EN PANTALLA: solo logo Wundeer centrado, fijo desde 0s. AUDIO: viento/atardecer muy bajo o instrumental mínima. CAPTION: Esenciales elevados. CTA: ninguno."
              - region [ref=e184]:
                - generic [ref=e185]:
                  - generic [ref=e187]: ÚLTIMO MOVIMIENTO · 11/09/2026, 8:15 p. m.
                  - generic [ref=e188]: Modo colaborativo · OWNER → IDEA APROBADA
                - generic [ref=e189]:
                  - generic [ref=e190]:
                    - paragraph [ref=e191]: "[SHARED_CONTEXT]"
                    - heading "Colaboración sin pérdida." [level=2] [ref=e192]
                  - generic [ref=e193]: 0 ABIERTOS · TODOS VEN EL MISMO HILO
                - paragraph [ref=e194]: "[ESPACIO COLABORATIVO] Todo cambio queda guardado en la base y visible para todos desde cualquier dispositivo."
                - generic [ref=e195]:
                  - generic [ref=e196]: HILO DE DECISIONES
                  - paragraph [ref=e199]: AÚN NO HAY COMENTARIOS EN ESTA PIEZA.
                  - generic [ref=e200]:
                    - textbox "Escribe una decisión, duda o ajuste..." [ref=e202]
                    - button "ENVIAR COMENTARIO →" [disabled] [ref=e204]
                - generic [ref=e205]:
                  - paragraph [ref=e206]: VERSIONES Y ARCHIVOS
                  - paragraph [ref=e207]: Centraliza referencia, guion, crudo y entregables. Cada carga deja una versión y nunca reemplaza la anterior.
                  - generic [ref=e208]:
                    - generic [ref=e210]:
                      - generic [ref=e211]: // TIPO DE ENTREGA
                      - combobox "// TIPO DE ENTREGA" [ref=e212]:
                        - option "REFERENCIA / BRIEF" [selected]
                        - option "GUIÓN"
                        - option "CONTENIDO CRUDO"
                        - option "EDICIÓN V1"
                        - option "EDICIÓN V2"
                        - option "EDICIÓN FINAL"
                        - option "PUBLICACIÓN / EVIDENCIA"
                    - generic [ref=e213] [cursor=pointer]:
                      - button "+ CARGAR REFERENCIA / BRIEF PDF · VIDEO · IMAGEN · GUIÓN" [ref=e214]
                      - generic [ref=e215]: + CARGAR REFERENCIA / BRIEF
                      - generic [ref=e216]: PDF · VIDEO · IMAGEN · GUIÓN
                  - generic [ref=e217]:
                    - paragraph [ref=e218]: HISTORIAL DE ENTREGAS
                    - paragraph [ref=e220]: AÚN NO HAY ARCHIVOS. CARGA EL GUION, EL CRUDO O UNA VERSIÓN PARA INICIAR EL HISTORIAL.
            - complementary [ref=e221]:
              - generic [ref=e222]:
                - paragraph [ref=e223]: // RESPONSABLE DE LA PIEZA
                - paragraph [ref=e224]: Sin responsable, cualquier cambio queda como "sin sesión". Nombra a alguien del equipo y la pieza deja de ser huérfana.
                - generic [ref=e225]:
                  - generic [ref=e226]: // QUIÉN RESPONDE
                  - combobox "// QUIÉN RESPONDE" [ref=e227]:
                    - option "Elige una persona…" [selected]
                - paragraph [ref=e228]: NO HAY ROSTRO EN ESTE PROYECTO.
                - button "ASIGNAR RESPONSABLE" [disabled] [ref=e230]
              - generic [ref=e233]:
                - paragraph [ref=e234]: // LO QUE FALTA DE ESTA FICHA
                - paragraph [ref=e235]: "Los cinco datos están completos: la pieza puede circular sin preguntas."
                - generic [ref=e237]:
                  - generic [ref=e238]:
                    - 'generic "REFERENCIA: listo" [ref=e239]'
                    - 'generic "CÁMARA: listo" [ref=e244]'
                    - 'generic "TALENTO: listo" [ref=e248]'
                    - 'generic "EDICIÓN: listo" [ref=e252]'
                    - 'generic "GUION: listo" [ref=e257]'
                  - generic [ref=e261]: INFO 5/5
      - contentinfo [ref=e262]:
        - generic [ref=e263]:
          - generic [ref=e264]:
            - img "RR Aliados" [ref=e265]
            - generic [ref=e266]:
              - paragraph [ref=e267]: Deployed by RR Aliados
              - paragraph [ref=e268]: Content Hub · WUNDEER
          - navigation "Enlaces del pie" [ref=e269]:
            - link "TABLERO" [ref=e270] [cursor=pointer]:
              - /url: /wundeer
            - link "BANCO DE IDEAS" [ref=e271] [cursor=pointer]:
              - /url: /wundeer/ideas
            - link "CAMBIAR DE PROYECTO" [ref=e272] [cursor=pointer]:
              - /url: /select-project
    - 'button "Abrir la guía: te explica cada botón" [ref=e273]': ¿CÓMO SE USA?
  - generic [ref=e281] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e282]
    - generic [ref=e286]:
      - button "Open issues overlay" [ref=e287]:
        - generic [ref=e288]:
          - generic [aria-hidden] [ref=e289]: "0"
          - generic [ref=e290]: "1"
        - generic [ref=e291]: Issue
      - button "Collapse issues badge" [ref=e292]
  - alert [ref=e295]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const FICHA = process.env.FICHA_PROD ?? '27fe6119-b7b6-4409-8aeb-0ae419d574ae';
  4  | const PROYECTO = 'wundeer';
  5  | const visto = () => window.localStorage.setItem('rr-hub-guia-v1', 'visto');
  6  | 
  7  | test.describe('asignar responsable', () => {
  8  |   test('el bloque nombra a alguien real del roster y explica el hueco', async ({ page }) => {
  9  |     await page.addInitScript(visto);
  10 |     await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });
  11 | 
  12 |     const bloque = page.getByRole('complementary').or(page.locator('aside'));
  13 |     // El bloque tiene que existir siempre, tenga o no responsable.
  14 |     await expect(page.getByText('// RESPONSABLE DE LA PIEZA').or(page.getByText('// RESPONSABLE'))).toBeVisible();
  15 | 
  16 |     // Sin responsable, el select ofrece el roster real, con nombre y rol.
  17 |     const select = page.getByLabel('// QUIÉN RESPONDE');
  18 |     if (await select.count()) {
  19 |       const opciones = await select.locator('option').allInnerTexts();
  20 |       expect(opciones.length, 'el roster de Wundeer tiene 16 personas').toBeGreaterThan(5);
  21 |       // Ninguna opción puede decir "sin sesión": es una persona, no un rol roto.
  22 |       expect(opciones.join(' ')).not.toContain('sin sesión');
  23 |       // Y el botón no se habilita hasta elegir: no se deshabilita por algo invisible.
  24 |       await expect(page.getByRole('button', { name: /ASIGNAR RESPONSABLE/ })).toBeDisabled();
  25 |     }
  26 |   });
  27 | 
  28 |   test('no promete una transición de rol: asignar no cambia la fase', async ({ page }) => {
  29 |     await page.addInitScript(visto);
> 30 |     await page.goto(`/${PROYECTO}/ideas/${FICHA}`, { waitUntil: 'networkidle' });
     |                ^ Error: page.goto: Test timeout of 45000ms exceeded.
  31 | 
  32 |     // Asignar un responsable es metadata, no un cambio de estado. Si alguien lo
  33 |     // metió en `allowedTransitions()`, aparecería un estado nuevo en el flujo de
  34 |     // 13 y esta aserción lo delataría.
  35 |     const grupo = page.getByRole('group', { name: 'Movimientos disponibles' });
  36 |     if (await grupo.isVisible().catch(() => false)) {
  37 |       const botones = await grupo.getByRole('button').allInnerTexts();
  38 |       expect(botones.join(' ')).not.toMatch(/ASIGNAR RESPONSABLE/i);
  39 |     }
  40 |   });
  41 | });
  42 | 
```