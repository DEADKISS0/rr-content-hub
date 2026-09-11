import { ROLE_LABEL, type RoleKey } from '@/lib/flow';

/**
 * Real-role guidance. Replaces the old role simulator: the role now comes from
 * the signed-in profile, so this panel explains what that person must do.
 */
const guidance: Record<RoleKey, { title: string; copy: string; bullets: string[] }> = {
  owner: { title: 'DIRIGES LA OPERACIÓN', copy: 'Preparas propuestas, consigues decisiones del cliente y confirmas que cada relevo arranca.', bullets: ['Enviar ideas y guiones al cliente', 'Desbloquear lo que esté detenido', 'Cerrar piezas con su historial'] },
  creator: { title: 'PROPONES EL CONCEPTO', copy: 'Conviertes referencias en propuestas claras y respondes los ajustes del cliente.', bullets: ['Completar referencia y briefs', 'Responder ajustes con evidencia', 'Reenviar la propuesta'] },
  camera: { title: 'RUEDAS LO APROBADO', copy: 'Solo trabajas piezas con guion aprobado. Sigues el brief y subes el crudo.', bullets: ['Leer planos, lente y luz', 'Grabar según el guion', 'Subir el crudo y avisar'] },
  model: { title: 'EJECUTAS EL TALENTO', copy: 'Ves vestuario, actitud y referencias de las piezas listas para rodar.', bullets: ['Revisar referencias y vestuario', 'Mantener continuidad', 'Confirmar rodaje'] },
  editor: { title: 'CONSTRUYES LA PIEZA', copy: 'Recibes el crudo centralizado, conservas versiones y entregas un corte.', bullets: ['Montar según el brief', 'Subir V1 y V2 con versiones', 'Marcar la edición lista'] },
  publisher: { title: 'PUBLICAS CON EVIDENCIA', copy: 'Solo recibes piezas aprobadas. Registras canal, URL y evidencia.', bullets: ['Revisar copy y formato', 'Registrar la salida', 'Adjuntar evidencia'] },
  media_buyer: { title: 'MIDE Y OPTIMIZA', copy: 'Registras hipótesis, resultados y qué formato conviene repetir.', bullets: ['Definir objetivo y audiencia', 'Registrar resultados', 'Decidir qué repetir'] },
  client_approver: { title: 'DECIDES', copy: 'Ves la propuesta, la referencia y el guion. Apruebas o pides ajustes.', bullets: ['Revisar la referencia', 'Aprobar o pedir ajustes', 'Confirmar restricciones de marca'] },
  client_viewer: { title: 'CONSULTAS', copy: 'Ves el avance del proyecto sin editar nada.', bullets: ['Consultar el estado', 'Leer el hilo de decisiones', 'Ver las publicaciones'] },
};

export function RoleView({ role }: { role: string }) {
  const key = (role in guidance ? role : 'owner') as RoleKey;
  const content = guidance[key];
  return <div className="brutal-panel">
    <p className="mono-label text-mostaza">// TU ROL · {ROLE_LABEL[key]}</p>
    <h3 className="mt-3 font-display text-2xl font-bold text-blanco">{content.title}</h3>
    <p className="mt-3 text-sm leading-6 text-blanco-60">{content.copy}</p>
    <ul className="mt-4 space-y-2 font-mono text-[11px] text-mostaza">{content.bullets.map((bullet) => <li key={bullet}>→ {bullet}</li>)}</ul>
    <p className="mt-5 border-t border-blanco-20 pt-4 font-mono text-[10px] leading-5 text-blanco-40">Este panel se asigna con tus credenciales; no se puede cambiar desde la interfaz.</p>
  </div>;
}
