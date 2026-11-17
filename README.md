# Portal del Colegio St Mary

Portal para las familias de St. Mary Catholic Virtue School. Un solo código (Expo + React Native) da tres versiones:

| Versión | Cómo se ve | Dónde se publica |
|---|---|---|
| Web en ordenador | Barra lateral a la izquierda con Home, Calendar, Ask, Inbox y Family | Vercel (proyecto `smfp`, rama `main`) |
| Web en el móvil | Barra de pestañas abajo, como la app | La misma URL de Vercel |
| App nativa iOS/Android | Pestañas nativas | Expo Go hoy; EAS Build cuando toque publicar en tiendas |

Las pantallas y funciones son las de la app móvil prototipo de `family-portal/mobile`, adaptadas a un solo colegio. No hay funciones nuevas.

**Usa solo datos de ejemplo.** Las familias, alumnos, eventos y mensajes son inventados. El inicio de sesión es simulado: no hay servidor ni base de datos todavía. Los datos de contacto del colegio (teléfono, email, dirección, horario) son los reales y públicos.

## Probarlo

```bash
npm install
npm run web          # web en http://localhost:8081
npx expo start       # app en el iPhone con Expo Go (escanea el QR)
```

- Entrar: cualquier correo y contraseña (la contraseña `wrong` simula un error). Código de dos pasos: cualquiera de 6 cifras menos `000000`.
- **Family → Settings → Prototype options**: simula plan sin IA, límite de IA, listas vacías, errores y modo sin conexión.

## Comandos

```bash
npm run typecheck    # TypeScript
npm test             # pruebas (vitest)
npm run build:web    # compila la web en dist/ (lo mismo que hace Vercel)
npx expo export -p ios   # comprueba que la app compila para iOS
```

## Estructura

- `src/app`: rutas (Expo Router). `src/app/(tabs)/_layout.tsx` son las pestañas nativas; `_layout.web.tsx` es la navegación web (barra lateral desde 900 px de ancho, barra inferior por debajo).
- `src/screens`, `src/components`, `src/theme`: pantallas, piezas y colores (navy #16335B y dorado #FCBC40 de St. Mary).
- `src/services/api.ts`: la única puerta a los datos. Hoy responde con `src/data/sample.ts`.
- `src/services/children-source.ts` y `server/sis/`: conector FACTS, **desactivado**. Ver [`docs/facts.md`](docs/facts.md).

## Seguridad del repositorio

El repositorio es público. `.gitignore` excluye `.env` y `.env.*` (salvo `.env.example`). Nunca subas claves.
