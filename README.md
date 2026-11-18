# Portal de familias de St. Mary (SMFP)

Paso 1: el portal actual de St. Mary Catholic Virtue School, rehecho como app Next.js
y con el mismo aspecto que el original
(`stmarycommunication.javiercela.me/Portal_202627/portal_202627.html`).

Todavía no hay base de datos, login ni panel. El código anterior (portal v1)
está guardado en la rama `backlog/portal-v1`.

## Cómo está hecho

| Archivo | Qué es |
|---|---|
| `reference/portal_202627.original.html` | Copia del HTML original (de la carpeta `Portal_202627` en Google Drive). |
| `scripts/import-original.py` | Separa el original en las tres piezas de abajo. |
| `app/portal.css` | Los estilos del original, sin cambios. |
| `content/portal-body.html` | El contenido de la página, sin cambios. |
| `public/portal.js` | El JavaScript del original (eventos, documentos, calendario, buscador), sin cambios. |
| `public/logo_white.png`, `public/favicon.png` | El logo y el icono del original. |
| `app/layout.tsx`, `app/page.tsx` | La página Next.js que junta todo. |

Único cambio respecto al original: los enlaces relativos (`assets/...`, `handbook_202627.html`, etc.)
apuntan ahora al sitio original, porque esos documentos y páginas aún no están en esta app.

Para actualizar desde un HTML nuevo: sustituir `reference/portal_202627.original.html` y ejecutar
`npm run import-original`.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
```
