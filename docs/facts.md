# Conector FACTS (desactivado)

El portal está preparado para leer de FACTS SIS **qué hijos tiene cada familia**. Hoy está apagado y la app usa los alumnos de ejemplo.

## Qué hay

| Pieza | Archivo | Estado |
|---|---|---|
| Interruptor y fuente de alumnos en la app | `src/services/children-source.ts` | Apagado (`EXPO_PUBLIC_FACTS_ENABLED=false`) |
| Interfaz común de conectores SIS | `server/sis/connector.ts` | Copiado de family-portal |
| Cliente FACTS (solo lecturas GET) | `server/sis/facts.ts` | Copiado de family-portal, **sin probar con un FACTS real** |

La app nunca habla con FACTS ni ve sus claves. Cuando se active, la app pide los hijos a la API del portal (`EXPO_PUBLIC_API_URL` + `/api/sis/children`) y la API llama a FACTS con las claves guardadas en el servidor.

## Qué falta para encenderlo

1. Pedir a FACTS la clave de suscripción (`Ocp-Apim-Subscription-Key`), la URL base de la API y la documentación de `/People`, `/Students` y `/People/ParentStudent`. El colegio crea su `Facts-Api-Key` en FACTS (System → Configuration → API Configuration, permiso "People").
2. Construir la API del portal con inicio de sesión real (el de hoy es simulado) y la ruta `/api/sis/children`, que use `server/sis/facts.ts`.
3. En Vercel, poner `FACTS_API_BASE_URL` y `FACTS_SUBSCRIPTION_KEY` (solo servidor), `EXPO_PUBLIC_API_URL` y `EXPO_PUBLIC_FACTS_ENABLED=true`.

## Lo que no está verificado

[Seguro] El cliente FACTS se escribió a partir de guías públicas de otros proveedores (Reach, PlusPortals, Gradelink). La URL base, los filtros y los nombres de campos de FACTS no están publicados. Cuando FACTS los confirme, solo hay que ajustar `server/sis/facts.ts`.
