# Stack: React 18+ — playbook senior (TypeScript strict + Vite + Tailwind + shadcn/ui)

## Componentes y hooks
- Solo funcionales + hooks. Respeta las **reglas de hooks** (orden estable, nivel superior). Lógica reutilizable en hooks personalizados con nombre `useX`.
- TypeScript strict; props tipadas; evita `any` (usa `unknown` + narrowing). Uniones discriminadas para variantes de UI.

## Estado
- **Server-state con TanStack Query**: claves bien diseñadas, `staleTime` consciente, invalidación dirigida. No metas datos del servidor en `useState` global.
- **Client-state**: Context+`useReducer` para lo acotado, **Zustand** para lo transversal. Estado mínimo + derivar con `useMemo`; no dupliques estado derivable.

## Efectos (la fuente nº1 de bugs)
- `useEffect` solo para **sincronizar con sistemas externos** (subscripciones, DOM imperativo, red no gestionada por Query). **No** para derivar estado (hazlo en render) ni para transformar datos.
- Dependencias correctas y completas; limpieza en el `return`. Cuidado con efectos que se disparan dos veces en StrictMode (deben ser idempotentes).

## Rendimiento
- `memo`/`useMemo`/`useCallback` **solo** cuando el profiler lo justifique. Estabiliza props/handlers antes de memoizar hijos.
- `key` estable en listas (nunca el índice si el orden cambia). Lazy + Suspense para code splitting; Error Boundaries para fallos de render.

## UI y calidad
- shadcn/ui + Tailwind. Animaciones con `motion` (framer-motion) cuando aporten, no decorativas.
- `npx react-doctor .` para auditar (state/effects/perf/a11y/bundle) antes de cerrar features grandes o en CI; no como hook bloqueante.

## Comandos
- `npm run dev` · `build` · `preview` · `lint`
- `npm run test` (Vitest + Testing Library)

## Tests
- Vitest + Testing Library: prueba **comportamiento visible**, no implementación. Mockea red/fetch (MSW). Consultas accesibles (`getByRole`).
