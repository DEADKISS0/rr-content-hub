import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
    // Esta clave NO la emite Next 16 por ninguna vía de su tipo (medido en
    // node_modules/next/dist). Sin ella iOS no ofrece "añadir a pantalla de
    // inicio" como app, y sale con barra de Safari.
    expect(layout).toMatch(/appleWebApp/);
    expect(layout).toMatch(/capable:\s*true/);
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
