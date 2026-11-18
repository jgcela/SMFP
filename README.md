# Portal de familias (SMFP)

Portal para las familias de un colegio, rehecho paso a paso a partir del portal HTML
original. Preparado para varios colegios: cada dato pertenece a un colegio y la web
muestra el colegio indicado en la variable `PORTAL_SCHOOL`.

- **Paso 1**: copia exacta del portal original como app Next.js (portada + 8 páginas + archivos).
- **Paso 2**: el contenido de la portada vive en una base de datos (Neon Postgres) y la página
  tiene el mismo aspecto.

Todavía no hay login ni panel. El código anterior (portal v1) está en la rama `backlog/portal-v1`.

## Qué sale de la base de datos (portada)

| Tabla | Qué guarda |
|---|---|
| `schools` | Un colegio por fila: nombre, ciudad, curso escolar, logo, teléfono, correo, horario, calendario de Google y cuántos días antes sale el aviso automático de "No school". |
| `notices` | El aviso destacado. Si hay uno activo (`is_active`, y hoy entre `show_from` y `show_until` si están puestas), se muestra ese; si no, el aviso automático del próximo día sin clase sacado de `events`. |
| `events` | Eventos del calendario con su categoría (`noclasses`, `faith`, `academic`, `community`, `health`). "This week and next", la vista mensual, la lista y el aviso automático salen de aquí. |
| `document_categories`, `documents` | "Family documents": grupos, documentos y su posición en "Most used" (`most_used_rank`). |
| `links` | Menú de arriba (`top`), menú de secciones (`sections`), menú del móvil (`menu_sections`, `menu_more`), "Popular" (`popular`) y el botón de FACTS (`facts`). |

Todas las tablas (menos `schools`) tienen `school_id`.

| Archivo | Qué es |
|---|---|
| `db/schema.sql` | Crea las tablas (se puede ejecutar más de una vez). |
| `scripts/seed-from-original.mjs` | Genera el SQL que carga un colegio a partir de la página original: `node scripts/seed-from-original.mjs <slug>`. |
| `lib/portal.ts` | Lee el contenido del colegio de la base de datos. |
| `lib/render.ts`, `content/portal-template.html` | La portada, con `{{...}}` donde va el contenido de cada colegio. |
| `public/portal.js` | El JavaScript original de la portada; ahora toma los datos de `window.__PORTAL__`. |
| `app/page.tsx` | La portada (`/` y `/portal_202627.html`). Se regenera como mucho cada minuto. |

Variables (en Vercel): `PORTAL_DATABASE_URL` (base de datos `portal` del proyecto Neon SMFP)
y `PORTAL_SCHOOL` (el `slug` del colegio).

## Páginas y archivos estáticos (paso 1)

| Archivo | Qué es |
|---|---|
| `reference/*.html` | Copia sin tocar de cada página HTML original. |
| `scripts/import-original.py` | Copia las páginas de `reference/` a `public/` y los estilos a `app/portal.css`. |
| `public/*_202627.html` | Las demás páginas (Messenger, Volunteer, Teacher wishlists, Staff favorites, Handbooks, Supply list). Siguen siendo HTML fijo. |
| `public/assets/` | La carpeta `assets` original completa. |
| `public/new-tab.js` | Los enlaces a PDFs, flyers, imágenes y otras webs se abren en una pestaña nueva; los enlaces entre páginas del portal, los saltos dentro de la página, los correos y los teléfonos, en la misma. |
| `next.config.ts` | `/portal_202627.html` lleva a la portada; cabecera `noindex` en todo. |

## Desarrollo

```bash
npm install
# Base de datos local de prueba:
psql "$PORTAL_DATABASE_URL" -f db/schema.sql
node scripts/seed-from-original.mjs <slug> tmp/seed && psql "$PORTAL_DATABASE_URL" -f tmp/seed/seed.sql
PORTAL_SCHOOL=<slug> npm run dev     # http://localhost:3000
```

## Paso 3: entrada del personal y aviso destacado

- `/admin`: inicio de sesión del personal (Better Auth, correo y contraseña). Sin registro público.
- Una vez dentro, un único formulario: texto del aviso, enlace opcional e interruptor mostrar/ocultar. Al guardar, la portada se actualiza al momento.
- Usuarios en la base `portal`: tablas `auth_user`, `auth_session`, `auth_account`, `auth_verification`.
- `school_staff` dice qué colegio puede editar cada usuario. El colegio sale siempre de `PORTAL_SCHOOL` y además tiene que estar en `school_staff`; el navegador no decide nada.
- Contraseña: `node scripts/staff-link.mjs <colegio> <correo> "<nombre>" <url-del-portal>` crea el usuario (si no existe) y un enlace de un solo uso (72 horas) para que la persona elija su contraseña. Solo se guarda el hash del enlace. Sirve también para restablecer una contraseña olvidada.
- `login_attempts`: tras 8 intentos fallidos en 15 minutos (por correo y por IP) se bloquea temporalmente.
- Variables nuevas: `BETTER_AUTH_SECRET` (obligatoria). Opcional `AUTH_HOSTS` (dominios propios, separados por comas).
