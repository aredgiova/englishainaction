# Verificación de la pila local completa

Esta comprobación necesita Docker Desktop funcionando, Supabase local, la semilla y Next.js. La integración PGlite aplica todas las migraciones en orden y verifica el dominio, pero no sustituye Auth, correo, PostgREST ni la concurrencia entre conexiones independientes.

Para un proyecto Supabase alojado, utiliza la [guía de integración alojada](supabase-hosted.md). Este guion conserva sus restricciones a loopback y sus cuentas ficticias; no debe apuntar al proyecto remoto.

1. Ejecuta `pnpm db:start`; si la base local ya existía, aplica las migraciones nuevas con `pnpm exec supabase migration up`. CLI 3.2.0 selecciona local por defecto. Si falla el acceso al ejecutable mediante pnpm, usa `node node_modules/supabase/dist/supabase.js migration up`, que invoca la misma versión fijada. Después ejecuta `pnpm demo:seed`.
2. Para la aceptación técnica, ejecuta `pnpm build` y abre otra terminal con `pnpm start`. El origen local debe seguir siendo `http://127.0.0.1:3000`, igual que Auth y `APP_URL`; `pnpm dev` queda disponible para desarrollo.
3. Ejecuta `pnpm verify:local` con `.env.local` generado. `APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL` y `MAILBOX_URL` deben ser direcciones locales. El script rechaza entornos remotos.

El acceso de fase 1 es por invitación: conserva `enable_signup = false` y las sesiones anónimas deshabilitadas en `supabase/config.toml`. La semilla provisiona el administrador ficticio únicamente en local. Para un entorno alojado nuevo, el procedimiento es `pnpm admin:bootstrap '<UUID-confirmado-de-Auth>'`, con las comprobaciones y credenciales administrativas temporales descritas en la guía alojada; no se reemplaza por un `UPDATE` genérico ni se ejecuta contra estas cuentas si ya existe un administrador.

El script utiliza cookies SSR reales y cuentas ficticias. Crea un curso nuevo por ejecución y lo conserva para inspección. Comprueba altas y reenvíos HTTP, publicación, matrícula única, calificación, avance 1/2 después de salir y entrar, aislamiento del estudiante sin matrícula, RLS vía PostgREST y prohibición de elevar el rol. También guarda título, nivel y público nuevos en el borrador: la API del estudiante debe conservar los valores y revisión publicados, y PostgREST no debe permitirle leer la fila mutable de `courses`. Abre dos conexiones PostgreSQL distintas para comprobar que dos correcciones simultáneas conservan un único intento. Repite la concurrencia mediante HTTP. Después publica una edición y comprueba que el intento antiguo continúa disponible mediante su clave original.

También crea un docente ficticio con correo único, comprueba el correo de invitación, consume el enlace de confirmación, establece una contraseña aleatoria y prueba la recuperación completa. Nunca imprime contraseñas, cookies ni tokens. Las cuentas y los cursos ficticios se conservan; `pnpm db:reset` borra los datos locales si se decide reiniciar la demostración.

La lectura del correo usa la ruta de integración `/view/latest.html?query=...` de [Mailpit](https://mailpit.axllent.org/docs/integration/), con filtros por destinatario y asunto. Un fallo del buzón hace fallar la comprobación; no se cuenta como correo validado.

## Alternativa manual si el buzón local usa otra implementación

1. Entra como `admin@englishinaction.test`, abre Administración e invita un correo ficticio nuevo con rol docente. Repite la misma invitación y comprueba el conflicto.
2. Abre el `MAILBOX_URL` de `.env.local`, normalmente `http://127.0.0.1:54324`. Localiza el correo enviado a esa cuenta. Ábrelo y sigue su enlace hacia `/auth/confirm?token_hash=…&type=invite` en una ventana sin otra sesión.
3. Comprueba que se abre `/definir-clave`, define una contraseña de al menos doce caracteres y verifica el panel docente. Cierra sesión.
4. En `/recuperar-clave`, solicita recuperación para ese mismo correo. Abre el nuevo mensaje en el buzón, sigue `/auth/confirm?token_hash=…&type=recovery`, establece otra contraseña y verifica que puedes volver a entrar.
5. Registra la fecha, el proveedor del buzón y el resultado. No guardes enlaces, contraseñas ni tokens en capturas o documentación.

Si Docker no está disponible, estas comprobaciones quedan pendientes. No ejecutes una semilla ni esta verificación contra el piloto o contra cuentas reales.
