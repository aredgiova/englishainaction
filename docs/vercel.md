# Despliegue manual en Vercel

Repositorio: [aredgiova/englishainaction](https://github.com/aredgiova/englishainaction). Frontend, sesiones SSR y API forman un único proyecto Next.js. El despliegue lo realiza el propietario desde Vercel; esta preparación no crea un proyecto ni publica un sitio en Vercel.

## Importación

1. En Vercel, abre **Add New → Project** e importa `aredgiova/englishainaction`, rama `main`.
2. Usa la raíz del repositorio (`./`) y **Next.js** como Framework Preset. Elige **Node.js 24.x**, también fijado por `package.json`.
3. Conserva los comandos de `vercel.json`: instalación `npx --yes pnpm@11.25.0 install --frozen-lockfile` y compilación `npx --yes pnpm@11.25.0 run build`. El directorio de salida queda en el valor predeterminado de Next.js.
4. Define el dominio HTTPS canónico que utilizarás y añade las cuatro variables siguientes al entorno **Production** antes de pulsar **Deploy**. Si Vercel asigna un dominio distinto al previsto, corrige `APP_URL` y los retornos de Auth, y realiza un nuevo despliegue antes de probar el ingreso.

El campo `git.deploymentEnabled: false` evita despliegues automáticos al recibir commits. La importación inicial y los despliegues posteriores quedan bajo control manual. Para publicar otra revisión, usa la creación manual de un despliegue desde `main` en Vercel. Si más adelante quieres automatizar cada push, cambia explícitamente ese campo a `true`.

## Variables de aplicación

| Nombre exacto | Valor que debes configurar |
| --- | --- |
| `APP_URL` | Origen HTTPS canónico, por ejemplo `https://tu-dominio.vercel.app`, sin ruta; debe coincidir con el dominio desde el que se usa la aplicación |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gpixjzkfovepghpdiikp.supabase.co` para continuar con el proyecto de pruebas actual |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publicable de ese mismo proyecto; el nombre conserva compatibilidad con claves `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave administrativa del mismo proyecto, añadida como variable sensible exclusivamente de servidor |

Los valores privados actuales están en `.env.local`, excluido de Git. Copia cada valor directamente al panel seguro de Vercel o desde Supabase; no los pegues en archivos versionados. Solo las dos variables `NEXT_PUBLIC_` pueden llegar al navegador. No añadas a Vercel `DATABASE_URL`, tokens de la CLI, contraseñas de base, `DEMO_PASSWORD`, variables `EIA_HOSTED_*`, ni el archivo `.env.example` completo.

Next.js incorpora las variables públicas durante la compilación: después de cambiarlas debes volver a desplegar. La aplicación valida `Origin` contra `APP_URL` en cada escritura. Usar otro alias o una URL de preview con las variables de Production ocasionará `403 invalid_origin`; accede desde el dominio canónico. Las pruebas en Preview requieren su propio origen exacto, variables y configuración de Auth, preferiblemente en un Supabase de pruebas separado.

## Supabase Auth y correo

Las migraciones `202611190001` y `202611190002` ya están aplicadas en `gpixjzkfovepghpdiikp`. El build de Vercel no ejecuta migraciones, bootstrap ni semillas.

Antes de usar el dominio desplegado, en **Supabase → Authentication → URL Configuration** configura:

- **Site URL:** el mismo origen HTTPS de `APP_URL`.
- **Redirect URLs:** `https://TU-DOMINIO/auth/confirm` y `https://TU-DOMINIO/definir-clave`, sustituyendo `TU-DOMINIO` por el dominio real.

Mantén el registro público y las sesiones anónimas deshabilitados, confirmación de correo habilitada y contraseña mínima de 12 caracteres. El perfil versionado `supabase/hosted/supabase/config.toml` ya usa `https://englishainaction.vercel.app` y sus dos retornos exactos; conserva también los retornos locales y de Vercel que existían antes. Este ajuste fue aplicado y comprobado mediante la CLI. Antes de reaplicarlo revisa siempre el diff. La [guía alojada](supabase-hosted.md) explica ese flujo.

Configura SMTP y las plantillas de invitación y recuperación de `supabase/templates/`. Ambas usan `/auth/confirm` y `token_hash`; la aplicación no tiene una ruta `/auth/callback`. El proveedor predeterminado del proyecto actual rechazó la personalización de plantillas, por lo que **la entrega real de correo sigue pendiente**. El ingreso por contraseña de identidades existentes ya fue probado. Las cuentas alojadas actuales son ficticias; completa el aprovisionamiento de cuentas operativas antes de abrir la academia a personas reales.

## Comprobación después de tu despliegue

1. Verifica que el build de Vercel termina correctamente y abre `/ingresar` en el dominio canónico.
2. Entra con una cuenta controlada existente y confirma que se abre su panel. Guarda un borrador o una entrega para comprobar también el origen permitido y la escritura en Supabase.
3. Sal y vuelve a entrar: curso, intentos y avance deben conservarse.
4. Tras completar SMTP, comprueba recepción y consumo de una invitación y de recuperación desde ese mismo dominio.

La [verificación de integración](VERIFICACION.md) contiene las pruebas locales y alojadas ya realizadas y sus límites. La ejecución real en Vercel y el correo desde su dominio se verifican después del despliegue manual.

## Referencias de configuración

- [Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).
- [Gestores de paquetes y selección de versiones](https://vercel.com/docs/package-managers).
- [Versiones de Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
- [Desactivar despliegues automáticos por Git](https://vercel.com/docs/project-configuration/git-configuration#turning-off-all-automatic-deployments).
- [Retornos permitidos de Supabase Auth](https://supabase.com/docs/guides/auth/redirect-urls).
