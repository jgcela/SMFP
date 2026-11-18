# Portal de familias de St. Mary (SMFP)

Paso 1: el portal actual de St. Mary Catholic Virtue School, rehecho como app Next.js
y con el mismo aspecto que el original
(`stmarycommunication.javiercela.me/Portal_202627/portal_202627.html`).

Todavía no hay base de datos, login ni panel. El código anterior (portal v1)
está guardado en la rama `backlog/portal-v1`.

## Cómo está hecho

Copia completa de la carpeta `Portal_202627` de Google Drive (la misma que sirve
`stmarycommunication.javiercela.me/Portal_202627/`): la portada, las 8 páginas enlazadas
y todos sus archivos (PDFs, imágenes, números del School Messenger).

| Archivo | Qué es |
|---|---|
| `reference/*.html` | Copia sin tocar de cada página HTML original. |
| `scripts/import-original.py` | Convierte `reference/` en lo que sirve la app. |
| `app/layout.tsx`, `app/page.tsx` | La portada como página Next.js (`/` y `/portal_202627.html`). |
| `app/portal.css`, `content/portal-body.html`, `public/portal.js` | Estilos, contenido y JavaScript de la portada, sin cambios. |
| `public/*_202627.html` | Las demás páginas (Messenger, Volunteer, Teacher wishlists, Staff favorites, Handbooks, Supply list). |
| `public/assets/` | La carpeta `assets` original completa. |
| `public/new-tab.js` | Hace que los enlaces a otras páginas y archivos se abran en una pestaña nueva. |
| `next.config.ts` | `/portal_202627.html` lleva a la portada; cabecera `noindex` en todo (como el `.htaccess` original). |

Cambios en el contenido:

- El logo se carga desde esta app (`assets/logo_white.png`) en lugar de desde
  `stmarycommunication.javiercela.me`.
- Cada página y cada número del Messenger carga `/new-tab.js`: todo enlace a otra página,
  PDF o web se abre en una pestaña nueva. Los saltos dentro de la misma página (`#calendar`),
  los correos (`mailto:`) y los teléfonos (`tel:`) funcionan como antes.

Todos los demás enlaces son los
originales, así que páginas, PDFs e imágenes los sirve esta app. Las imágenes dentro de
los números del Messenger siguen viniendo de Flocknote, igual que en el original.

Para actualizar: sustituir los HTML en `reference/` (o los archivos en `public/assets/`)
y ejecutar `npm run import-original`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```
