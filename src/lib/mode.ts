/**
 * Ya no hay modo público.
 *
 * Antes `AUTH_ENABLED` era un interruptor entre "todo abierto" y "login de
 * Google". Desde el 2026-09-28 la puerta es un código de cuatro dígitos por
 * cliente, y eso no se apaga: el código se comprueba siempre, en el servidor, y
 * sin él no hay cookie, y sin cookie no se entra.
 *
 * El interruptor se conserva con este valor porque hay código que lo lee para
 * decidir si ensaya o no, y borrarlo a medio refactor rompe el build por
 * cosas que no tienen que ver con la puerta.
 *
 * - `AUTH_ENABLED` siempre vale `true`: la puerta está encendida.
 * - `PUBLIC_MODE` siempre vale `false`: no existe el modo abierto.
 *
 * Lo que NO significa esto: que entrar te dé permisos. El código abre la puerta
 * del cliente; lo que puedes hacer dentro lo decide `rr_hub_access`. Eso se
 * comprueba en el guard de cada mutación, no aquí.
 */
export const AUTH_ENABLED = true;
export const PUBLIC_MODE = false;
