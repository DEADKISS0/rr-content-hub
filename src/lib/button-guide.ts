import type { RoleKey } from '@/lib/flow';

/**
 * Button-by-button reference. Every control the person can touch, explained in
 * three explicit beats: WHAT it does, WHEN to use it, and WHAT happens after.
 * The help center renders this per role so each member only sees their tools.
 */
export type ButtonHelp = {
  label: string;
  section: 'FLUJO' | 'ACCIONES DE FICHA' | 'NAVEGACIÓN';
  where: string;
  what: string;
  when: string;
  after: string;
  roles: RoleKey[]; // empty = visible to every role
};

export const BUTTON_HELP: ButtonHelp[] = [
  // ── Transiciones del flujo (mueven la pieza de estado) ─────────────
  { label: 'ENVIAR IDEA AL CLIENTE', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Mueve la propuesta de BORRADOR a ESPERA CLIENTE para que el cliente decida.', when: 'Cuando el brief y la referencia ya están completos y no quieres que la idea se quede en borrador.', after: 'La idea pasa a la cola "POR DECIDIR" y queda registrada con tu rol y fecha. Le toca al cliente.', roles: ['owner', 'creator'] },
  { label: 'APROBAR IDEA', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Confirma que la dirección creativa está aprobada y arranca la fase de guion.', when: 'Cuando la propuesta (referencia + objetivo) representa lo que la marca quiere comunicar.', after: 'La pieza pasa a IDEA APROBADA y el equipo de ideación puede empezar a escribir el guion.', roles: ['client_approver', 'owner'] },
  { label: 'SOLICITAR AJUSTES', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Devuelve la propuesta al equipo con la pelota en su cancha para corregir.', when: 'Cuando algo de la referencia, el tono o el objetivo no te convence.', after: 'La pieza pasa a AJUSTES PEDIDOS y queda registrado que el cliente pidió cambios.', roles: ['client_approver', 'owner'] },
  { label: 'ARCHIVAR PROPUESTA', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Descarta la idea sin perderla: queda cerrada pero conserva todo su historial.', when: 'Cuando la propuesta no va a avanzar (cambio de plan, no encaja con la campaña).', after: 'La pieza pasa a CERRADO y deja de aparecer en las colas activas.', roles: ['client_approver', 'owner'] },
  { label: 'REENVIAR AL CLIENTE', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Vuelve a enviar la propuesta ya ajustada para una nueva decisión.', when: 'Después de aplicar los cambios que pidió el cliente.', after: 'La pieza vuelve a ESPERA CLIENTE y la decisión queda pendiente de nuevo.', roles: ['owner', 'creator'] },
  { label: 'INICIAR GUIÓN', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Arranca la escritura del guion sobre una idea ya aprobada.', when: 'Cuando la idea está aprobada y toca convertirla en un guion ejecutable.', after: 'La pieza pasa a GUIÓN EN CURSO y se habilita el editor de guion.', roles: ['owner', 'creator'] },
  { label: 'ENVIAR GUIÓN AL CLIENTE', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Entrega el guion terminado para validación del cliente.', when: 'Cuando el guion escena por escena ya está pulido y listo para aprobarse.', after: 'La pieza pasa a GUIÓN POR APROBAR. Le toca al cliente.', roles: ['owner', 'creator', 'editor'] },
  { label: 'APROBAR GUIÓN', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Valida el guion y libera la pieza para producción.', when: 'Cuando el guion refleja lo que se quiere grabar y el cliente está de acuerdo.', after: 'La pieza pasa a GUIÓN APROBADO y entra a la cola de PRODUCCIÓN.', roles: ['client_approver', 'owner'] },
  { label: 'PEDIR CAMBIOS AL GUIÓN', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Devuelve el guion al equipo para ajustarlo antes de rodar.', when: 'Cuando el guion no captura la intención o tiene algo que corregir.', after: 'La pieza pasa a AJUSTES PEDIDOS y vuelve a manos de ideación.', roles: ['client_approver', 'owner'] },
  { label: 'INICIAR RODAJE', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Confirma que producción arranca con el guion aprobado.', when: 'Cuando cámara está lista para grabar según el brief de cámara.', after: 'La pieza pasa a RODAJE EN CURSO y aparece en el pipeline de producción.', roles: ['owner', 'camera', 'model'] },
  { label: 'MARCAR CRUDO CARGADO', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Registra que el material crudo ya está subido y listo para edición.', when: 'Inmediatamente después de grabar y subir los archivos crudos.', after: 'La pieza pasa a CRUDO SUBIDO y le toca al editor.', roles: ['owner', 'camera'] },
  { label: 'INICIAR EDICIÓN', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Confirma que el editor arranca el montaje sobre el crudo.', when: 'Cuando el editor va a empezar a montar la pieza.', after: 'La pieza pasa a EN EDICIÓN y sigue el pipeline de producción.', roles: ['owner', 'editor'] },
  { label: 'MARCAR EDICIÓN LISTA', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Declara el corte terminado y lo deja en revisión final.', when: 'Cuando el corte está listo para la última aprobación antes de salir.', after: 'La pieza pasa a REVISIÓN FINAL y le toca al owner o publisher.', roles: ['owner', 'editor'] },
  { label: 'APROBAR Y PUBLICAR', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Aprueba la revisión final y publica la pieza.', when: 'Cuando el corte final está aprobado y es momento de salir.', after: 'La pieza pasa a PUBLICADO y queda en la cola de salidas.', roles: ['owner', 'publisher', 'media_buyer', 'client_approver'] },
  { label: 'CERRAR FLUJO', section: 'FLUJO', where: 'Ficha de idea · panel "QUÉ HACER AHORA"', what: 'Cierra la pieza conservando todo su historial intacto.', when: 'Al terminar el ciclo completo de una pieza publicada.', after: 'La pieza pasa a CERRADO y deja de aparecer en las colas activas.', roles: ['owner', 'publisher'] },

  // ── Acciones dentro de la ficha ──────────────────────────────────────
  { label: 'GUARDAR GUIÓN', section: 'ACCIONES DE FICHA', where: 'Ficha de idea · panel "TU VISTA · IDEACIÓN"', what: 'Persiste el guion editable en la base de datos.', when: 'Cada vez que terminas de escribir o ajustar el guion escena por escena.', after: 'El guion queda guardado con tu rol y fecha; cámara, modelo y edición ya lo ven.', roles: ['owner', 'creator'] },
  { label: 'PUBLICAR COMENTARIO', section: 'ACCIONES DE FICHA', where: 'Ficha de idea · "HILO DE DECISIONES"', what: 'Añade una decisión, duda o ajuste al hilo compartido.', when: 'Siempre que dejes contexto: una aprobación, un matiz de marca o una pregunta.', after: 'El comentario queda visible para todos con tu rol y fecha.', roles: [] },
  { label: 'MARCAR RESUELTO / REABRIR', section: 'ACCIONES DE FICHA', where: 'Ficha de idea · cada comentario', what: 'Marca un comentario como resuelto (o lo reabre).', when: 'Cuando la duda o el ajuste ya quedó atendido.', after: 'El comentario se atenúa y deja de contar como "abierto".', roles: [] },
  { label: '+ CARGAR REFERENCIA / BRIEF', section: 'ACCIONES DE FICHA', where: 'Ficha de idea · "VERSIONES Y ARCHIVOS"', what: 'Sube un archivo (imagen, video, PDF, DOC) a una etapa de la pieza.', when: 'Para adjuntar referencia, guion, crudo o evidencia según tu rol.', after: 'El archivo queda versionado (v1, v2…) y visible en el historial.', roles: [] },
  { label: 'ABRIR ORIGINAL ↗', section: 'ACCIONES DE FICHA', where: 'Ficha de idea · cabecera de la referencia', what: 'Abre la referencia original en su plataforma (Instagram, Drive, YouTube…).', when: 'Cuando necesitas ver el contenido fuente completo o a mayor resolución.', after: 'Se abre en una pestaña nueva sin salir de la ficha.', roles: [] },

  // ── Navegación global ────────────────────────────────────────────────
  { label: '+ NUEVA IDEA', section: 'NAVEGACIÓN', where: 'Mapa · botón superior derecho', what: 'Abre el formulario de captura de una idea nueva.', when: 'Cuando quieres registrar una propuesta desde cero.', after: 'Vas al formulario donde pegas la referencia y el sistema genera el brief y el guion.', roles: ['owner', 'creator'] },
  { label: 'VER TODO →', section: 'NAVEGACIÓN', where: 'Mapa · botón superior derecho', what: 'Abre el banco completo de piezas con búsqueda y filtros.', when: 'Cuando quieres buscar una pieza específica entre todas.', after: 'Vas a la vista de banco con filtros por tipo y estado.', roles: [] },
  { label: 'IR A MI COLA →', section: 'NAVEGACIÓN', where: 'Sidebar · panel "TU PAPEL"', what: 'Te lleva directo a la cola de tu rol.', when: 'Al entrar, para ver solo lo que te toca resolver.', after: 'Aterrizas en la vista filtrada por las piezas que esperan tu acción.', roles: [] },
  { label: 'CAMBIAR ROL', section: 'NAVEGACIÓN', where: 'Sidebar · esquina inferior', what: 'Abre el selector de rol para cambiar de vista.', when: 'Cuando quieres ver la plataforma como otro miembro del equipo.', after: 'Se abre el panel de roles; al elegir, toda la vista se reconfigura.', roles: [] },
];

export function buttonsForRole(role: RoleKey): ButtonHelp[] {
  return BUTTON_HELP.filter((button) => button.roles.length === 0 || button.roles.includes(role));
}
