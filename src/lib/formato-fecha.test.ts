import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fechaEs, fechaIsoCorta, cuantoPara } from './fecha-salida';

/**
 * MEDIDO 2026-10-01: se programaron 14 ideas de Wundeer con fecha real. Para
 * que eso se viera hubo que hacer la fecha visible, y para que se viera BIEN
 * hubo que formatearla.
 *
 * El detalle que hace que esto no sea cosmético: la fecha se guarda como ISO con
 * zona. `new Date('2026-10-02T00:00:00.000Z')` es el 1 de octubre en Colombia
 * (UTC-5), así que un `getDate()` a secas pinta el día ANTERIOR al que alguien
 * programó. Una fecha de salida que muestra el día equivocado es peor que no
 * mostrarla: alguien filma el día que no era.
 *
 * Estas pruebas fijan el formato y, sobre todo, que no se salga del mes.
 */

// El 2 de octubre de 2026 fue viernes.
const DOS_OCTUBRE = '2026-10-02T00:00:00.000Z';

describe('la fecha se lee en español y corta', () => {
  it('formatea día, número y mes', () => {
    expect(fechaEs(DOS_OCTUBRE)).toBe('vie 2 oct');
  });

  it('no devuelve null cuando la fecha existe', () => {
    expect(fechaEs(DOS_OCTUBRE)).not.toBeNull();
  });

  it('la zona no mueve la fecha al día anterior', () => {
    // El fallo concreto: el ISO es UTC y Colombia es UTC-5. Si el formateador
    // leyera UTC, el 2 se vería el 1. Se mide el mes también, porque un cambio
    // de día en la frontera de mes es el caso que más confunde.
    expect(fechaEs('2026-11-01T00:00:00.000Z')).toContain('nov');
    expect(fechaEs('2026-10-02T00:00:00.000Z')).toContain('oct');
    expect(fechaEs('2026-10-01T00:00:00.000Z')).toContain('oct');
  });

  it('devuelve null si no hay fecha o no se entiende', () => {
    expect(fechaEs(null)).toBeNull();
    expect(fechaEs(undefined)).toBeNull();
    expect(fechaEs('')).toBeNull();
    expect(fechaEs('no-es-fecha')).toBeNull();
  });
});

describe('la fecha para el calendario es el día corto', () => {
  it('saca el yyyy-mm-dd que entiende el input', () => {
    expect(fechaIsoCorta(DOS_OCTUBRE)).toBe('2026-10-02');
  });

  it('null si no hay fecha', () => {
    expect(fechaIsoCorta(null)).toBeNull();
  });
});

describe('la cuenta regresiva es honesta', () => {
  /**
   * MEDIDO 2026-10-01: este bloque usaba `new Date().toISOString()`, que es UTC.
   * `cuantoPara()` cuenta en `America/Bogota`. Entre las 19:00 y las 24:00 de
   * Bogotá, UTC ya va un día por delante: "hoy" en el test era "mañana" para la
   * función, y el test fallaba solo después de las siete de la tarde.
   *
   * No lo detectó nadie porque el gate se corre de día, y porque en el momento
   * de escribirlo había coincidido. Un test que depende de la hora del reloj no
   * mide la función: mide cuándo se escribió.
   *
   * Aquí las fechas se fabrican en hora de Bogotá, con la misma zona que usa la
   * función. Si algún día hay que cambiar la cuenta, este test lo dice.
   */
  const enBogota = (dias: number) => {
    const base = new Date();
    // Se construye desde las partes locales de Bogotá, no sumando milisegundos.
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    });
    const [anio, mes, dia] = fmt.format(base).split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias, 12, 0, 0));
    return fecha.toISOString();
  };

  it('hoy y mañana tienen palabras, no números', () => {
    // Calcular "en 0 días" y "en 1 días" es leer un reloj, no un plan.
    expect(cuantoPara(enBogota(0))?.texto).toBe('hoy');
    expect(cuantoPara(enBogota(1))?.texto).toBe('mañana');
  });

  it('una fecha pasada dice que está vencida, no que es urgente', () => {
    // El signo cambia el mensaje entero: una pieza vencida es un problema, no
    // una urgencia.
    const r = cuantoPara(enBogota(-1));
    expect(r?.vencido).toBe(true);
    expect(r?.texto).toContain('hace');
  });

  it('una fecha futura no está vencida', () => {
    const enDiez = enBogota(10);
    expect(cuantoPara(enDiez)?.vencido).toBe(false);
    expect(cuantoPara(enDiez)?.texto).toBe('en 10 días');
  });

  it('sin fecha no hay cuenta atrás que inventar', () => {
    expect(cuantoPara(null)).toBeNull();
    expect(cuantoPara('basura')).toBeNull();
  });
});

describe('el dia se cuenta en la zona del cliente, no en la del servidor', () => {
  /**
   * MEDIDO 2026-10-03. El CI fallo con 2 de 10 pruebas en UTC y paso en Bogotá:
   * `setHours(0,0,0,0)` usa la zona del SERVIDOR. Vercel corre en UTC, así que
   * desde las 19:00 en Colombia "hoy" salía como "mañana" y una salida para el
   * día siguiente decía "hoy". No era solo un problema de pruebas.
   */
  it('el dia de hoy se lee igual sin importar donde corra el servidor', () => {
    const hoy = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    expect(cuantoPara(hoy)?.texto).toBe('hoy');
    expect(cuantoPara(hoy)?.vencido).toBe(false);
  });

  it('una salida manana sigue siendo manana, no hoy', () => {
    // El caso que se rompe de noche: en UTC, "manana" cae en el dia siguiente.
    const manana = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(Date.now() + 86_400_000));
    expect(cuantoPara(manana)?.texto).toBe('mañana');
  });

  it('la zona esta escrita en el codigo, no la pone el runtime', () => {
    // Si alguien quita 'America/Bogota' y deja que la maquina decida, esto
    // falla aunque las pruebas sigan verdes en una maquina en Bogota.
    const src = readFileSync(join(process.cwd(), 'src/lib/fecha-salida.ts'), 'utf8');
    expect(src).toMatch(/timeZone: 'America\/Bogota'/);
    expect(src).not.toMatch(/hoy\.setHours|new Date\(\)\.setHours/);
  });
});
