import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esPublica } from '@/lib/public-rutas';

/**
 * El hub tiene que poder instalarse como app.
 *
 * Santiago, 2026-09-30: "hasta que se pueda descargar como 'app' con el icono de
 * RR desde el navegador, asi como acceso directo desde Android y iPhone".
 *
 * Estas comprobaciones miran el ARCHIVO, no el comportamiento en el navegador,
 * porque hay cuatro cosas que sí fallan no dan ningún error visible: el manifest
 * que no se declara, el icono de iOS que falta (iOS saca una captura de la
 * pagina, que aqui es un rectangulo negro), la clave `apple-mobile-web-app-capable`
 * que Next 16 no emite solo, y el service worker cacheando de mas.
 */

const raiz = new URL('../../', import.meta.url).pathname;
const leer = (ruta: string) => readFileSync(raiz + ruta, 'utf8');

const layout = leer('src/app/layout.tsx');
const manifest = leer('src/app/manifest.ts');
const sw = leer('public/sw.js');
const config = leer('next.config.ts');
const instalar = leer('src/components/instalar-app.tsx');

describe('El hub se puede instalar como app', () => {
  it('el layout declara el manifest, los iconos y la clave de iOS', () => {
    // Sin `manifest` el navegador no ofrece instalar nada, por muy bonitos que
    // sean los iconos.
    expect(layout).toMatch(/manifest:\s*'\/manifest\.webmanifest'/);
    // `apple-touch-icon` es el icono de la pantalla de inicio en iOS. Sin él,
    // iOS saca una captura de la pagina.
    expect(layout).toMatch(/apple:\s*\[\{\s*url:\s*'\/app\/apple-touch-icon\.png'/);
    // CUIDADO CON LA DIFERENCIA, que se mide en produccion (2026-09-30):
    // Next emite `mobile-web-app-capable` desde `appleWebApp`, pero Safari SÍ
    // lee `apple-mobile-web-app-capable`, CON prefijo. Con la de Next sola, el
    // iPhone abre con barra de Safari y no aparece instalar como app. Por eso la
    // de Apple va a mano en `other`, y el test vigila el prefijo exacto.
    expect(layout).toMatch(/'apple-mobile-web-app-capable':\s*'yes'/);
    expect(layout).toMatch(/title:\s*'RR Hub'/);
  });

  it('el manifest lleva los iconos que exigen las plataformas', () => {
    // 192 y 512 son obligatorios en el manifest; maskable es lo que Android usa
    // cuando recorta en circulo o en squircle.
    expect(manifest).toMatch(/icono-192\.png/);
    expect(manifest).toMatch(/icono-512\.png/);
    expect(manifest).toMatch(/icono\('maskable-192\.png', '192x192'\), purpose: 'maskable'/);
    expect(manifest).toMatch(/icono\('maskable-512\.png', '512x512'\), purpose: 'maskable'/);
    // Sin esto la app se abre en el navegador, que es justo lo que no se quiere.
    expect(manifest).toMatch(/display:\s*'standalone'/);
    // `id` fijo: si cambia, Android trata la app como distinta y reaparece.
    expect(manifest).toMatch(/id:\s*'\/wundeer'/);
  });

  it('el service worker NUNCA cachea datos vivos', () => {
    // Este hub muestra estados, votos y portadas que cambian. Cachear el HTML
    // de una ficha sería mostrar "aprobo algo que ya no es cierto".
    // - la navegacion va SIEMPRE a la red
    expect(sw).toMatch(/peticion\.mode === 'navigate'/);
    // - las API pasan de largo
    expect(sw).toMatch(/startsWith\('\/api\/'\)/);
    // - y solo se guarda lo que lleva hash en el nombre: el armazon de Next
    expect(sw).toMatch(/startsWith\('\/_next\/static\/'\)/);
    // Las peticiones que no son GET (escritura) no se tocan.
    expect(sw).toMatch(/method !== 'GET'/);
  });

  it('el service worker necesita sus propias cabeceras', () => {
    // Sin `Service-Worker-Allowed: /` el SW se queda con el ambito de `/sw.js` y
    // no puede cachear el armazon de Next, que es justo para lo que se registra.
    expect(config).toMatch(/source:\s*"\/sw\.js"[\s\S]{0,600}Service-Worker-Allowed/);
    // Y sin `no-store` en el propio SW, el navegador lo cachea y la version
    // nueva no llega nunca: la app se queda pegada a la anterior.
    expect(config).toMatch(/source:\s*"\/sw\.js"[\s\S]{0,600}no-store/);
  });

  it('el manifest y los iconos se sirven SIN sesion', () => {
    // ESTE ERA EL BUG QUE HACIA INEXISTENTE TODA LA PWA (medido en produccion
    // el 2026-09-30, dos veces): el proxy de sesion exigia cookie en toda ruta,
    // asi que `/manifest.webmanifest` devolvia un 307 a `/login`. El navegador
    // recibia HTML donde esperaba JSON, no encontraba nombre ni icono, y no
    // aparecia el boton de instalar en ningun movil. Sin ningun error visible:
    // sencillamente no habia app.
    //
    // Y LA SEGUNDA VEZ, MAS SUTIL: `/app/` estaba en la lista de publicas, el
    // archivo contenia la palabra, un test que mirase texto pasaria en verde...
    // y los doce iconos seguian devolviendo 307, porque la comparacion busca
    // `${p}/` y eso es `/app//`. Por eso aqui NO se mira texto: se importa la
    // funcion y se EJERTA.
    for (const ruta of [
      '/manifest.webmanifest',
      '/sw.js',
      '/offline',
      '/login',
      '/app/icono-192.png',
      '/app/maskable-512.png',
      '/app/apple-touch-icon.png',
    ]) {
      expect(esPublica(ruta), `${ruta} deberia servirse sin sesion`).toBe(true);
    }
    // Y la puerta sigue cerrada. Abrir de mas seria peor que el bug original:
    // dejaria el hub entero sin sesion.
    for (const ruta of ['/wundeer', '/candlejas', '/api/votar', '/wundeer/ideas/x1']) {
      expect(esPublica(ruta), `${ruta} NO deberia servirse sin sesion`).toBe(false);
    }
    // El proxy tiene que usar ESA funcion, no su propia copia: dos reglas
    // distintas en dos sitios divergen sin que nada se entere.
    const mw = leer('src/lib/supabase/middleware.ts');
    expect(mw).toMatch(/import \{ esPublica \} from '@\/lib\/public-rutas'/);
    expect(mw).toMatch(/if \(esPublica\(path\)\)/);
  });

  it('la app se abre en la portada, no en un 307 al login', () => {
    // EL CICLO ROTO (Santiago, 2026-09-30: "el link principal está dañado...
    // cuando lo mantengo oprimido me salen las opciones de navegación y le doy
    // inicio"). Medido, no supuesto:
    //
    //   `start_url` = /wundeer  →  al abrir la app el proxy ve que no hay sesión
    //   → 307 a /login  →  y el login no tenía NI UN ENLACE. La app quedaba
    //   atrapada en la puerta, sin forma de volver.
    //
    // Y por qué NO es `/`: se midió y la portada tampoco sirve sin sesión.
    // `src/app/page.tsx` hace `redirect('/login')` sin cookie, porque
    // `rr_hub_projects` está detrás del RLS. Arrancar en `/` daba el MISMO 307.
    // La portada no es la puerta: es el tablero, y el tablero necesita sesión.
    expect(manifest).toMatch(/start_url: '\/login\?fuente=app'/);
    // Ni `/` ni `/wundeer`: los dos dan 307 al login.
    expect(manifest).not.toMatch(/start_url: '\/wundeer'/);
    expect(manifest).not.toMatch(/start_url: '\/'[,\s]/);

    // El otro extremo del ciclo: el login TIENE que tener salida.
    const login = leer('src/app/login/page.tsx');
    expect(login).toMatch(/VOLVER A LA PORTADA/);
    expect(login).toMatch(/<Link href="\/"/);

    // Y `/login` TIENE que ser pública de verdad, comprobado EJECUTANDO la
    // regla y no leyendo la lista: `start_url` apunta ahí, así que si
    // `esPublica('/login')` fuera falso, la app seguiría abriendo en un 307.
    // OJO: `request.nextUrl.pathname` en Next NO lleva la query, asi que
    // `esPublica` nunca ve '/login?fuente=app'. Probarlo seria probar un caso
    // que no existe. Lo que importa es el pathname limpio.
    expect(esPublica('/login')).toBe(true);

    // OJO, la trampa que me llevé: `/` NO es pública aunque lo parezca.
    // `esPublica('/')` da false, y es lo correcto: `page.tsx` redirige al login
    // sin cookie. Lo que la hace pública es la rama de la puerta, no esta lista.
    expect(esPublica('/')).toBe(false);
  });

  it('la app instalada no ofrece volver a instalar, y en iOS explica el camino', () => {
    // Dos comportamientos distintos que no se pueden mezclar:
    // - En Chromium el boton de instalar solo sale si hay `beforeinstallprompt`,
    //   y no sale si la app ya esta instalada (display-mode: standalone).
    // - En iOS no hay evento nunca: sale la guia de Compartir.
    // Si se mostró el boton de instalar dentro de la app, era un bucle.
    expect(instalar).toMatch(/yaInstalada && !actualizada/);
    expect(instalar).toMatch(/matchMedia\('\(display-mode: standalone\)'\)/);
    expect(instalar).toMatch(/Añadir a pantalla de inicio/);
  });

  it('el boton de instalar guarda el evento y no lo gasta al entrar', () => {
    // `beforeinstallprompt` se dispara UNA vez. Si se pide en el efecto al
    // entrar, al cerrarlo no hay segunda oportunidad.
    expect(instalar).toMatch(/beforeinstallprompt/);
    expect(instalar).toMatch(/preventDefault\(\)/);
    expect(instalar).toMatch(/setInvitacion/);
    // iOS no dispara ese evento nunca: ahi se explica el camino en vez de
    // prometer una descarga que no existe.
    expect(instalar).toMatch(/iPad\|iPhone\|iPod/);
    expect(instalar).toMatch(/Añadir a pantalla de inicio/);
  });

  it('el componente no hace setState sincrono en un efecto', () => {
    // El linter de React 19 lo rechaza y CI se pone en rojo. Se comprueba aqui
    // para que el fallo se vea en el test y no en el push.
    const efectos = instalar.match(/useEffect\(\(\) => \{[\s\S]*?\n  \}, \[\]\);/g) ?? [];
    for (const efecto of efectos) {
      expect(efecto).not.toMatch(/setYaInstalada|setEsIOS|setEntendidoIOS/);
    }
  });
});
