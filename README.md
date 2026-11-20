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

## Paso 4a: calendario desde el panel

- `/admin/calendar`: lista de eventos por fecha con buscador (por defecto solo los próximos; "Show past events" muestra el resto). Crear, editar y borrar (pide confirmación).
- Campos: título, fecha, hora o "All day", categoría (No school, Faith, Academic, Community) y nota opcional. Los eventos antiguos de "Health" conservan su categoría al editarlos.
- `/admin/calendar/import`: importa .ics o .csv con vista previa; nada se guarda hasta pulsar Import. Se saltan los que ya existen (misma fecha y título). Las horas de .ics se pasan a la zona horaria del colegio (`schools.timezone`).
- Cada cambio regenera la portada: "This week and next", el calendario mensual y el aviso automático de "No school".
- Base de datos: `events.start_time` (vacío = todo el día) y `schools.timezone`. Cambio de datos de una vez: `db/migrations/2026-11-18-step4a-event-times.sql` (ya aplicado en Neon).

## Paso 4b: documentos desde el panel

- `/admin/documents`: categorías (crear, renombrar, ordenar, borrar si están vacías) y documentos (crear, editar, borrar con confirmación, ordenar dentro de su categoría, "Most used").
- Un documento es un enlace (por ejemplo, Google Drive) o un archivo subido: PDF, Word o imagen, hasta 25 MB. El tipo real se comprueba por el contenido del archivo, no por el nombre.
- Los archivos van directamente del navegador a Cloudflare R2 (bucket `R2_PRIVATE_BUCKET`, carpeta `documents/<colegio>/`) con un enlace firmado. El bucket necesita la regla CORS que permite `PUT` desde el dominio del portal.
- El portal enlaza `doc/<id>`, que redirige a un enlace firmado de 10 minutos. La descripción corta aparece antes del tipo ("Due Sept 4 · PDF · 0.2 MB").
- `/api/health` dice si la web llega a la base de datos y al almacenamiento (solo true/false).
- Pruebas en local sin R2: `STORAGE_LOCAL_DIR=/ruta` guarda los archivos en disco (nunca en Vercel).

## Step 4c: links

Staff edit the portal's links at `/admin/links`: the "Popular" shortcuts, the main
menu (top bar and phone menu) and the FACTS button (which can be changed or
hidden, not deleted). Each link has its text, address, whether it opens in a new
tab, and can be hidden or reordered. Addresses must start with `https://`, or be
one of the portal's own pages, files or sections; `lib/links.ts` checks this in
the browser before saving and again on the server. The list of the portal's own
files (`lib/public-files.json`) is regenerated before every build.
Database change: `db/migrations/2026-11-18-step4c-links.sql`.

## Step 4d: contact details

Staff edit the school's phone, email, street address, office hours and optional
contact people at `/admin/contact`. Both places on the portal ("Need the front
office?" and "We're here for your family.") are built from these same fields.
The phone link (`tel:`) is made from the number, and the address links to the
map. `lib/contact.ts` checks the phone and email in the browser before saving
and again on the server. No school's details are in the code.
Database change: `db/migrations/2026-11-18-step4d-contact.sql`.

## Step 4e: text pages

Staff edit the portal's text pages at `/admin/pages` with a simple editor
(titles, bold, italic, lists, checklists, links, tables, images). Each page has
a draft and a published copy: families only see the published one, at
`/pages/<slug>`. Every saved draft and every publish is kept in `page_versions`,
and any of them can be put back in the draft. A page with three or more section
titles gets the handbook layout: a contents list built from its titles and a
search box. HTML is cleaned on save (`lib/page-html.ts`).

Old addresses such as `supply-list_202627.html` answer with a permanent redirect
to the new page (`app/[legacy]/route.ts`), using the page's `legacy_path`.
Images are uploaded to the private bucket and served through `/files/...`; the
browser uploads straight to R2, so the bucket needs a CORS rule that allows `PUT`
from the portal's address.

The two handbooks were imported from the old pages kept in `content/legacy/`.
Before each build, `scripts/seed-legacy-pages.mjs` adds any old page there that
the school does not have yet (and moves portal links to its new address); pages
already imported are never touched. `node scripts/import-legacy-page.mjs <school> <file>`
prints the same import as SQL. Old addresses that now lead elsewhere (the Supply
list became its PDF) are in the `redirects` table.
Database change: `db/migrations/2026-11-18-step4e-pages.sql`.

## Step 5: families sign in, approved by the school

The public portal stays open to everyone. Families create an account at
`/family/register` with their name, email, a password and the school code
(`schools.family_code`, handed out by the school). The account is "pending"
until staff approve it in `/admin/families`, where they can also reject or turn
off accounts and change the school code (the old code stops working at once).
Families sign in at `/family`. A family that is not approved never gets a
session, and turning a family off signs it out everywhere.

A family belongs to one school (`families.school_id`), and everything is read
for this deployment's school (`PORTAL_SCHOOL`). Sign-in accounts (`auth_user`) are
shared with staff, but staff rights come only from `school_staff` and family
rights only from `families`. `lib/family.ts` (`currentFamily()`) is the one place
that says whether someone is an approved family; FACTS sign-in (SSO) can later
link to the same row through `families.sso_provider` / `sso_subject` without
changing the approval flow.
Database change: `db/migrations/2026-11-18-step5-families.sql`.

## Step 6a: My family

Migration: `db/migrations/2026-11-19-step6a-my-family.sql` (family contact columns, `children`, `family_submissions`).

- `/family`, for an approved family: report an absence, make a request (both lists show the status), its children (read only) and family details (parents, phone, optional second adult). Actions in `app/family/my-actions.ts`; every query is limited to the signed-in family (`currentFamily()`).
- `/admin/requests` ("Absences & requests"): everything families of this school send. Filters by date (Today, Tomorrow, Next 7 days, or from/to), status and type, kept in the address. Each row has Received / In progress / Resolved buttons.
- `/admin/families/[id]` ("Children & details" in Families): a family's contact details, and its children. Only the school adds, edits and removes children (`updated_by` keeps who did it); families cannot.
- Children have a `facts_id` column for when they come from FACTS. No emails or automatic notices yet.

## Step 6b: Volunteer

Migration: `db/migrations/2026-11-19-step6b-volunteer.sql` (`volunteer_opportunities`, `volunteer_signups`, and the page's title, lead and "steps" part on `schools`).

- `/volunteer` (`app/volunteer/route.ts`, `content/volunteer-template.html`, `renderVolunteerPage` in `lib/render.ts`): the page, built from the data, with the old look and filters (`public/volunteer.js`). Open to everyone. Opportunities with "Families sign up on the portal" show the spots left: a signed-in family signs up or cancels (`/volunteer/signup`, a plain form post); a full one cannot be joined (checked inside a transaction, so two families never get the last spot); visitors see "Sign in to sign up", which brings them back after signing in.
- Staff: `/admin/volunteer` to create, edit, hide and delete (with confirmation); `/admin/volunteer/[id]` lists who signed up, with a CSV download.
- Import: `scripts/seed-volunteer.mjs` (prebuild) reads the old page in `content/volunteer/` once per school: its 12 opportunities (with their own sign-up buttons, portal sign-up off, no spot limit), the title, lead and steps. It then sends the old address `volunteer-opportunities_202627.html` to `/volunteer` and moves menu links there. It never runs again for that school.
- No emails or reminders yet.

## Step 6c: Staff favorites

Migration: `db/migrations/2026-11-19-step6c-staff-favorites.sql` (`staff_favorites`, and the page's teams, title, lead and notes on `schools`). There are no birthday or allergy columns on purpose.

- `/staff-favorites` (`app/staff-favorites/route.ts`, `content/staff-favorites-template.html`, `renderStaffPage` in `lib/render.ts`): only families the school approved, and the school's staff, see the cards, with the old look, search by name or role and team filters (`public/staff-favorites.js`). Anyone else gets a sign-in notice that brings them back (to the same `#staff-surname` card) after signing in. Card anchors are the old ones.
- Optional photo per card, in private storage (`staff/<school>/…`), served by `/staff-favorites/photo/[id]` only to someone who may see the page.
- Staff: `/admin/staff-favorites` to create, edit (name, role, group, photo, favorites in order: the first 4 visible, the rest under "More favorites", wishlist link), hide, move up/down within a group, and delete (with confirmation).
- Import: `scripts/seed-staff-favorites.mjs` (prebuild) reads the old page in `content/staff-favorites/` once per school, WITHOUT birthdays, the Allergies field and the health details in `content/staff-favorites/redactions.json` (the import stops if one of those is not found). It then sends the old address `staff-favorites_202627.html` to `/staff-favorites` and moves menu links there.

## Step 6d: Teacher wishlists

Migration: `db/migrations/2026-11-19-step6d-wishlists.sql` (`wishlists`, and the page's groups, title, lead and notes on `schools`).

- `/wishlists` (`app/wishlists/route.ts`, `content/wishlists-template.html`, `renderWishlistPage` in `lib/render.ts`): only families the school approved, and the school's staff, see the lists, with the old look, search by teacher, class or group, and group filters (`public/wishlists.js`). Anyone else gets the same sign-in notice as Staff favorites.
- Each list is joined to the teacher's Staff favorites card, so the name is written once (changing it there changes it here); "Favorite things" opens that card. A list can also have its own name for someone who is not in Staff favorites.
- Staff: `/admin/wishlists` to create, edit (teacher, class, group, store link), hide, move up/down within a group, and delete (with confirmation). There are no items on the portal: the school decided the teacher's store list (Amazon) is where items are kept.
- Import: `scripts/seed-wishlists.mjs` (prebuild, after the Staff favorites import) reads the old page in `content/wishlists/` once per school: the 18 lists, joined by surname (`content/wishlists/links.json` settles a surname with two cards), Amazon links without their `?ref=` part. It sends `teacher-wishlists_202627.html` to `/wishlists`, moves menu links there, and points each card's "Classroom wishlist" button to its list.
- No emails are sent.
- Staff favorites: a second card with the same surname now gets its own anchor (`staff-<surname>-<id>`).

## Step 7: look of the private panels

The staff area (/admin) and "My family" (/family) share one look: a sidebar (a "Menu" button on phones), page headings with the school's name, white cards, one main button per screen, rows with Edit and a "…" menu.

- Colours, short name and emblem come from `schools.panel_theme` (jsonb), per school. `content/panel/theme.json` fills in missing keys once at build time (`scripts/seed-panel-theme.mjs`); what the school already has is never changed. `categories` gives one colour per calendar category; the pill text is darkened until it reads at 4.5:1.
- Code: `lib/panel-theme.ts`, `app/admin/panel.css`, `app/admin/chrome.tsx`, `app/admin/ui.tsx`, `app/admin/icons.tsx` (one icon per section).
- No functions, data or addresses changed. The public portal is untouched.

## Step 9: emails, forgotten password, Family sign-in button

- Emails go through Resend (`lib/mail.ts`). Vercel variables: `RESEND_API_KEY` (only in Vercel, never in the code) and `MAIL_FROM` (an address on a domain verified in Resend). The sender name is the school's name and replies go to the school's email. Without a key nothing is sent; on a local copy `MAIL_OUTBOX_DIR` saves each email as a .json file.
- The emails (`lib/emails.ts`) are in English and take the school's name, logo and colours from the database: account received, account approved (with the sign-in link), account rejected, and a notice to the school when a new family is waiting. The school sets that address in Panel → Settings (`schools.notify_email`; empty sends nothing).
- Forgotten password, for staff (/admin/forgot-password) and families (/family/forgot-password): the email gets a link that works once, for 1 hour (`lib/email-links.ts`, table `email_links`, which keeps only a hash of the token). The screen says the same whether or not the account exists. Setting a new password signs the account out everywhere.
- Changing the account's email: Settings (/admin/settings, /family/settings). It needs the current password and is confirmed with a link sent to the new address; until then the old email stays.
- At most 8 emails per address and per computer every 15 minutes.
- A "Family sign-in" button sits in the public header on every page, on computers and phones, and leads to /family.
- Migration: `db/migrations/2026-11-20-step9-email.sql`.
