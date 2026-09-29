-- Once cuentas del equipo no podian entrar, y la causa no era el login.
--
-- Lo que pasaba (2026-09-28): 11 de las 19 cuentas de `auth.users` estaban
-- creadas A MANO en la base, sin fila en `auth.identities`. Nacieron de un
-- INSERT directo —alguien las preaprovisionó para que el equipo tuviera perfil—
-- pero GoTrue no las conoce: su tabla de identidades es la que dice "esta cuenta
-- existe y entra por correo". Sin esa fila, pedir el codigo de acceso a una de
-- esas cuentas devolvia:
--
--     duplicate key value violates unique constraint "users_email_partial_key"
--
-- o sea que la cuenta se veia, el correo era correcto, y el sistema respondia
-- "ese correo ya esta dado de alta" —que es verdad, y a la vez inútil—. El
-- resultado: 11 personas del roster, entre ellas Tefa y el propio Santiago, no
-- recibian nunca el codigo y no podian entrar al hub por ningun camino.
--
-- Que se listen el mail y se descarten las cuentas de proveedor se comprobe con
-- `select` antes de escribir nada. Y el arreglo se hace con una sola fila por
-- cuenta: provider `email`, provider_id = el id de la propia cuenta. Es lo que
-- deja GoTrue cuando alguien entra con magic link, que es exactamente el metodo
-- que quedo.

-- 1. Las cuentas sin identidad, y lo que se les va a poner.
do $$
declare
  huerfana record;
begin
  for huerfana in
    select u.id, u.email
      from auth.users u
     where not exists (select 1 from auth.identities i where i.user_id = u.id)
  loop
    insert into auth.identities
      (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at)
    values (
      gen_random_uuid(),
      huerfana.id,
      'email',
      huerfana.id::text,
      jsonb_build_object(
        'sub',   huerfana.id::text,
        'email', huerfana.email,
        'phone_verified', false,
        'email_verified', true
      ),
      now(), now(), null
    )
    on conflict do nothing;
  end loop;
end
$$;

comment on table auth.identities is
  'Una cuenta de correo necesita su fila aqui. Una fila en auth.users sin su identidad es una cuenta que GoTrue no reconoce, y pedirle codigo de acceso devuelve "correo ya dado de alta" sin llegar a mandar nada. Por eso preaprovisionar cuentas es INSERT en las dos tablas, no solo en auth.users.';