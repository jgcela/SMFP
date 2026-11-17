# Portal del Colegio St Mary

El portal de familias de St. Mary Catholic Virtue School, con datos reales.

- **Familias**: la misma app en la web (escritorio y móvil) y en iOS/Android. Es la app Expo de `mobile/`. En la web se publica en la raíz del portal; en el móvil se instala como app.
- **Oficina del colegio**: el panel de administración en `/s/stmary/admin` (anuncios, calendario, documentos, bandeja de ausencias y peticiones, familias, alumnos).
- **Servidor**: Next.js con Neon Postgres, Better Auth y Cloudflare R2. La app habla con él por la API `/api/app/v1` (cookie de sesión en la web, token en el llavero del móvil).
- **FACTS**: las fichas de alumnos pueden venir de FACTS SIS (`src/server/sis/facts.ts`). Está desactivado; se activa en el panel del colegio cuando haya claves de FACTS.

### Despliegue (Vercel)

`npm run vercel-build` aplica migraciones y el seed (idempotente), exporta la app web a `public/` y compila Next. Producción usa la base de datos principal de Neon; las previews de la rama de trabajo usan la rama `preview` de Neon (variables `DATABASE_URL` y `DB_SETUP_ON_PREVIEW` limitadas a esa rama).

Variables: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `APP_TENANT_KEY=stmary`, `PLATFORM_ROOT_DOMAIN`, `AUTH_EXTRA_HOSTS`, `ALLOW_PATH_TENANTS=true`, `CRON_SECRET`, `SEED_OWNER_*` (solo para crear la primera cuenta). Pendientes: `R2_*` (documentos) y `ANTHROPIC_API_KEY` (asistente Ask). Sin correo todavía: las contraseñas olvidadas las resuelve la oficina.

### App móvil

```
cd mobile
npm install
EXPO_PUBLIC_API_URL=https://<dominio-del-portal> npx expo start
```

Documentación heredada de family-portal:

- [`docs/01-auditoria.md`](docs/01-auditoria.md), [`docs/02-arquitectura.md`](docs/02-arquitectura.md), [`docs/03-estado.md`](docs/03-estado.md).

## Probarlo en tu Mac (paso a paso)

Necesitas Node.js 22 o superior (nodejs.org, versión LTS) y el proyecto clonado en `~/family-portal`.

1. Abre **Terminal** y entra en el proyecto:
   ```
   cd ~/family-portal
   git pull
   npm install
   ```
2. Abre el archivo `.env` (en la carpeta `family-portal`, con TextEdit) y comprueba que tiene tu `DATABASE_URL` de Neon. Añade estas líneas debajo:
   ```
   BETTER_AUTH_SECRET=pega-aqui-un-texto-largo-y-aleatorio-de-40-caracteres
   PLATFORM_ROOT_DOMAIN=localhost
   ALLOW_PATH_TENANTS=true
   SEED_OWNER_EMAIL=tu-email@ejemplo.com
   SEED_OWNER_PASSWORD=una-contraseña-de-12-o-más-caracteres
   SEED_OWNER_NAME=Tu Nombre
   ```
   Para el secreto puedes escribir en Terminal `openssl rand -base64 32` y copiar el resultado.
3. Crea las tablas y el colegio St. Mary:
   ```
   npm run db:migrate
   npm run db:seed
   ```
   Debe decir "Migrations applied." y "Created tenant St. Mary Catholic Virtue School".
4. Arranca la aplicación:
   ```
   npm run dev
   ```
5. En el navegador:
   - App de familias: http://localhost:3000 (antes ejecuta `npm run build:app` una vez)
   - Portal web clásico: http://stmary.localhost:3000
   - Administración del colegio: http://stmary.localhost:3000/admin (entra con el email y contraseña del paso 2)
   - Panel de plataforma: http://localhost:3000/platform

Para pararla, vuelve a Terminal y pulsa `Control + C`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Arranca en modo desarrollo |
| `npm test` | Pruebas automáticas (necesitan PostgreSQL local, ver abajo) |
| `npm run typecheck` | Comprueba tipos de TypeScript |
| `npm run build` | Compila para producción |
| `npm run db:check` | Comprueba la conexión a la base de datos |
| `npm run db:generate` | Genera una migración tras cambiar `src/server/db/schema` |
| `npm run db:migrate` | Aplica migraciones pendientes |
| `npm run db:seed` | Crea planes, St. Mary y la primera cuenta |

### Pruebas

Las pruebas crean una base `family_portal_test` en un PostgreSQL local (no tocan Neon). Por defecto usan `postgres://postgres:postgres@localhost:5432/postgres`; cámbialo con `TEST_ADMIN_DATABASE_URL`.

## Publicar en Vercel (resumen)

1. En Vercel: **Add New → Project**, importa `jgcela/family-portal`.
2. En **Settings → Environment Variables** añade `DATABASE_URL` (la conexión *pooled* de Neon), `BETTER_AUTH_SECRET`, `PLATFORM_NAME`, `PLATFORM_ROOT_DOMAIN` y `AUTH_EXTRA_HOSTS` con el dominio `*.vercel.app` que te asigne Vercel.
3. Cada despliegue aplica solo las migraciones pendientes. Solo la primera vez hay que ejecutar `npm run db:seed` contra Neon desde tu Mac.

Operación diaria de la plataforma: [`docs/06-operacion-plataforma.md`](docs/06-operacion-plataforma.md). Guía para los administradores de cada colegio: [`docs/05-school-admin-guide.md`](docs/05-school-admin-guide.md).
4. Sin dominio propio, St. Mary queda en `https://tu-app.vercel.app/s/stmary`.

Vercel Hobby es solo para uso no comercial.
