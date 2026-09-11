import type { RoleKey } from '@/lib/flow';

/**
 * Role-aware onboarding content. Each role gets its own guided tour: what it
 * does, where each of the four flow steps sits for it, and exactly which
 * buttons it will use. The tour is the "instructor" the owner asked for.
 */
export type TourStep = {
  kicker: string;
  title: string;
  body: string;
  bullets: string[];
};

export type RoleTour = {
  role: RoleKey;
  label: string;
  mission: string;
  steps: TourStep[];
};

const flowStep = (
  role: RoleKey,
  n: string,
  name: string,
  what: string,
  yours: string,
): TourStep => ({
  kicker: `PASO ${n} DEL FLUJO`,
  title: name,
  body: what,
  bullets: [`→ Tu papel aquí: ${yours}`],
});

export const ROLE_TOURS: Record<RoleKey, RoleTour> = {
  owner: {
    role: 'owner',
    label: 'ADMINISTRADOR',
    mission: 'Ves todo y coordinas: desbloqueas lo detenido, consigues decisiones del cliente y confirmas que cada relevo arranque.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'ERES EL CENTRO DE CONTROL.',
        body: 'Como administrador no estás atado a una sola fase: entras a cualquier pieza y puedes moverla cuando el equipo se traba.',
        bullets: ['→ Tienes todos los botones de transición disponibles', '→ El panel "BLOQUEOS VISIBLES" es tu radar diario', '→ Puedes editar guiones igual que ideación'],
      },
      flowStep('owner', '1', 'IDEA', 'La propuesta nace y espera decisión del cliente.', 'Destrabas la propuesta, la envías al cliente o la devuelves a ideación.'),
      flowStep('owner', '2', 'GUIÓN', 'Se escribe y se aprueba el guion.', 'Confirmas que el guion esté listo para rodar o lo ajustas tú mismo.'),
      flowStep('owner', '3', 'PRODUCCIÓN', 'Rodaje, crudo y edición.', 'Acompañas el pipeline: grabación → crudo → edición → listo.'),
      flowStep('owner', '4', 'PUBLICADO', 'Salida y cierre.', 'Apruebas la salida y cierras la pieza conservando su historial.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En la ficha de cada idea, el panel "TU SIGUIENTE ACCIÓN" te muestra exactamente los movimientos legales desde el estado actual.',
        bullets: ['→ ENVIAR IDEA AL CLIENTE · APROBAR GUIÓN · APROBAR Y PUBLICAR', '→ Cada botón te dice a qué estado pasará y a quién le tocará después', '→ "CAMBIAR ROL" está abajo a la izquierda para verlo como otro miembro'],
      },
    ],
  },
  creator: {
    role: 'creator',
    label: 'IDEACIÓN',
    mission: 'Conviertes referencias en propuestas claras, escribes los guiones y respondes los ajustes del cliente.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'ERES LA CHISPA DEL FLUJO.',
        body: 'Todo empieza aquí. Tu trabajo es que la idea se entienda sola: referencia visual, objetivo, briefs y un guion listo para producir.',
        bullets: ['→ Creas ideas nuevas desde "+ NUEVA IDEA"', '→ El guion se genera solo y tú lo afinas antes de guardar', '→ Cuando el cliente pide cambios, la pelota vuelve a ti'],
      },
      flowStep('creator', '1', 'IDEA', 'Propones, pegas la referencia y defines el objetivo.', 'Aquí mandas tú: crear, completar briefs y enviar al cliente.'),
      flowStep('creator', '2', 'GUIÓN', 'El guion se escribe y se aprueba.', 'Eres quien lo escribe y ajusta hasta que el cliente lo apruebe.'),
      flowStep('creator', '3', 'PRODUCCIÓN', 'Rodaje y edición.', 'Ya no actúas, pero sigues el hilo por si producción necesita contexto.'),
      flowStep('creator', '4', 'PUBLICADO', 'La pieza sale.', 'Confirmas que la salida respetó la idea original.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En la ficha verás el editor de guion y los botones de envío.',
        bullets: ['→ GUARDAR GUIÓN (tu editor editable, escena por escena)', '→ ENVIAR IDEA AL CLIENTE · REENVIAR AL CLIENTE · INICIAR GUIÓN', '→ Cada envío queda registrado con tu rol y fecha'],
      },
    ],
  },
  camera: {
    role: 'camera',
    label: 'PRODUCCIÓN / CÁMARA',
    mission: 'Ruedas únicamente lo aprobado, siguiendo el brief de cámara, y subes el crudo.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'RODAS LO QUE YA TIENE DIRECCIÓN.',
        body: 'No improvisas: cada pieza aprobada trae un brief de cámara con planos, luz y ubicación. Tu trabajo es ejecutarlo y subir el material.',
        bullets: ['→ Solo ves piezas con guion aprobado', '→ El brief de cámara es tu hoja de ruta en el set', '→ Al terminar, marcas el crudo cargado'],
      },
      flowStep('camera', '1', 'IDEA', 'Se propone y decide.', 'Todavía no entras; esperas a que se apruebe la dirección.'),
      flowStep('camera', '2', 'GUIÓN', 'Se aprueba el guion.', 'Aparece en tu cola PRODUCCIÓN: ya puedes preparar el rodaje.'),
      flowStep('camera', '3', 'PRODUCCIÓN', 'Grabación y crudo.', 'Este es tu terreno: grabar según el brief y subir el crudo.'),
      flowStep('camera', '4', 'PUBLICADO', 'Sale la pieza.', 'La pieza ya no te necesita, pero queda tu material en el historial.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En la ficha de una pieza lista para rodar verás el movimiento que te corresponde.',
        bullets: ['→ INICIAR RODAJE · MARCAR CRUDO CARGADO', '→ Sube archivos en "VERSIONES Y ARCHIVOS" (video crudo)', '→ El brief de cámara está arriba, siempre visible'],
      },
    ],
  },
  model: {
    role: 'model',
    label: 'MODELAJE',
    mission: 'Interpretas el talento: vestuario, actitud y continuidad según el brief.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'ERES LA CARA DE LA PIEZA.',
        body: 'Tu brief te dice exactamente cómo moverte, qué vestuario llevar y qué actitud sostener. La referencia es tu espejo.',
        bullets: ['→ Lees el brief de talento/modaje antes de rodar', '→ La referencia visual te muestra el tono exacto', '→ Sostienes continuidad entre tomas'],
      },
      flowStep('model', '1', 'IDEA', 'Se propone.', 'Esperas a que la idea se apruebe.'),
      flowStep('model', '2', 'GUIÓN', 'Se aprueba.', 'Aparece en tu cola: ya conoces el personaje y la intención.'),
      flowStep('model', '3', 'PRODUCCIÓN', 'Rodaje.', 'Ejecutas el talento en set, siguiendo el brief.'),
      flowStep('model', '4', 'PUBLICADO', 'Sale.', 'La pieza publicada conserva tu interpretación.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'Principalmente consultas y comentas; la acción de rodaje la coordina cámara.',
        bullets: ['→ El brief de modelaje está arriba en la ficha', '→ Usa el hilo de decisiones para dudas de vestuario o actitud', '→ Puedes ver la referencia embebida al lado del brief'],
      },
    ],
  },
  editor: {
    role: 'editor',
    label: 'EDICIÓN',
    mission: 'Montas el crudo según el brief de edición, conservas versiones y entregas el corte.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'CONSTRUYES EL CORTE.',
        body: 'Recibes el crudo centralizado y lo conviertes en pieza siguiendo ritmo, textos y cierre definidos en el brief de edición.',
        bullets: ['→ El brief de edición es tu guion de montaje', '→ Subes V1, V2… sin pisar la versión anterior', '→ Cuando está listo, marcas la edición terminada'],
      },
      flowStep('editor', '1', 'IDEA', 'Se propone.', 'No entras todavía.'),
      flowStep('editor', '2', 'GUIÓN', 'Se aprueba.', 'Conoces la intención y el ritmo que pide la pieza.'),
      flowStep('editor', '3', 'PRODUCCIÓN', 'Edición.', 'Tu fase: montar, versionar y entregar el corte.'),
      flowStep('editor', '4', 'PUBLICADO', 'Sale.', 'El corte publicado es tu entregable final.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En una pieza en crudo verás tus transiciones.',
        bullets: ['→ INICIAR EDICIÓN · MARCAR EDICIÓN LISTA', '→ Sube cortes en "VERSIONES Y ARCHIVOS"', '→ El pipeline de producción te muestra en qué paso vas'],
      },
    ],
  },
  publisher: {
    role: 'publisher',
    label: 'PUBLISHER',
    mission: 'Publicas piezas con revisión final, registras canal, URL y evidencia.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'PONEMOS LA PIEZA EN LA CALLE.',
        body: 'Solo recibes piezas aprobadas para salir. Registras dónde y cuándo se publicó, con su evidencia.',
        bullets: ['→ Tu cola PUBLICACIÓN muestra lo listo para salir', '→ Registras canal, copy, fecha y enlace', '→ Adjuntas la evidencia de la salida'],
      },
      flowStep('publisher', '1', 'IDEA', 'Se propone.', 'Esperas.'),
      flowStep('publisher', '2', 'GUIÓN', 'Se aprueba.', 'Esperas.'),
      flowStep('publisher', '3', 'PRODUCCIÓN', 'Se edita.', 'Esperas a que la revisión final esté lista.'),
      flowStep('publisher', '4', 'PUBLICADO', 'Sale.', 'Aquí actúas: programar, publicar y evidenciar.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En la pieza lista para publicar verás la acción de salida.',
        bullets: ['→ APROBAR Y PUBLICAR · CERRAR FLUJO', '→ Adjunta evidencia en archivos', '→ Registra el enlace de la publicación'],
      },
    ],
  },
  media_buyer: {
    role: 'media_buyer',
    label: 'PAUTA',
    mission: 'Mides y optimizas: hipótesis, resultado y qué formato conviene repetir.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'CERRAS EL CICLO CON DATOS.',
        body: 'Conectas cada pieza publicada con su objetivo y resultado, para decidir qué se repite y qué se descarta.',
        bullets: ['→ Tu cola PUBLICACIÓN muestra lo publicado', '→ Registras hipótesis y resultados', '→ Tu lectura alimenta la siguiente ideación'],
      },
      flowStep('media_buyer', '1', 'IDEA', 'Se propone.', 'Aportas contexto de audiencia y objetivo.'),
      flowStep('media_buyer', '2', 'GUIÓN', 'Se aprueba.', 'Revisas que el guion sirva al objetivo de pauta.'),
      flowStep('media_buyer', '3', 'PRODUCCIÓN', 'Se produce.', 'Esperas.'),
      flowStep('media_buyer', '4', 'PUBLICADO', 'Se mide.', 'Registras resultado y decides qué repetir.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'Principalmente registras resultados y comentas.',
        bullets: ['→ Registra hipótesis y resultados en la pieza', '→ Usa el hilo para notas de optimización', '→ Sin botones de transición: tu valor está en el dato'],
      },
    ],
  },
  client_approver: {
    role: 'client_approver',
    label: 'CLIENTE',
    mission: 'Apruebas o pides ajustes sobre propuestas y guiones.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'TÚ DECIDES.',
        body: 'Ves la propuesta, la referencia y el guion. Tu decisión (aprobar, pedir ajustes o archivar) queda ligada a la pieza.',
        bullets: ['→ Tu cola "POR DECIDIR" muestra lo que espera tu respuesta', '→ Cada decisión queda registrada con fecha', '→ Si algo no representa la marca, lo dejas escrito en comentarios'],
      },
      flowStep('client_approver', '1', 'IDEA', 'Propuesta lista.', 'Aquí decides: aprobar, pedir ajustes o archivar.'),
      flowStep('client_approver', '2', 'GUIÓN', 'Guion listo.', 'Apruebas el guion o pides cambios.'),
      flowStep('client_approver', '3', 'PRODUCCIÓN', 'Se produce.', 'Observas el avance sin intervenir.'),
      flowStep('client_approver', '4', 'PUBLICADO', 'Sale.', 'Ves el resultado final publicado.'),
      {
        kicker: 'TUS BOTONES',
        title: 'QUÉ VAS A PULSAR.',
        body: 'En la ficha de una pieza que espera tu decisión verás exactamente tus opciones.',
        bullets: ['→ APROBAR IDEA · SOLICITAR AJUSTES · ARCHIVAR', '→ APROBAR GUIÓN · PEDIR CAMBIOS', '→ La referencia embebida te muestra exactamente qué se aprobaría'],
      },
    ],
  },
  client_viewer: {
    role: 'client_viewer',
    label: 'CLIENTE (LECTURA)',
    mission: 'Consultas el avance del proyecto sin editar nada.',
    steps: [
      {
        kicker: 'QUIÉN ERES',
        title: 'CONSULTAS, NO EDITAS.',
        body: 'Tienes vista de todo el flujo para seguir el avance, pero no aparecerán botones de acción ni edición.',
        bullets: ['→ Ves el mapa y cada pieza en su estado real', '→ Lees el hilo de decisiones y el historial', '→ No puedes modificar nada'],
      },
      flowStep('client_viewer', '1', 'IDEA', 'Propuesta.', 'La consultas.'),
      flowStep('client_viewer', '2', 'GUIÓN', 'Guion.', 'Lo lees.'),
      flowStep('client_viewer', '3', 'PRODUCCIÓN', 'Producción.', 'Sigues el avance.'),
      flowStep('client_viewer', '4', 'PUBLICADO', 'Salida.', 'Ves el resultado.'),
      {
        kicker: 'QUÉ VES',
        title: 'SIN BOTONES.',
        body: 'Tu valor está en la consulta: todo el contexto, cero acciones.',
        bullets: ['→ Solo lectura en toda la plataforma', '→ Puedes cambiar de rol si te dieron permisos de decisión'],
      },
    ],
  },
};

export function roleTour(role: RoleKey): RoleTour {
  return ROLE_TOURS[role] ?? ROLE_TOURS.owner;
}
