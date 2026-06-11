# Stack: Next.js (App Router + TypeScript)

## App Router (el cambio mental clave)
- Todo en `app/`. Los componentes son **Server Components por defecto**; añade `"use client"` **solo** cuando necesites interactividad, hooks de estado/efecto o APIs del navegador. No lo pongas "por si acaso": rompe el streaming y engorda el bundle del cliente.
- Mutaciones con **Server Actions** (`"use server"`); APIs con **Route Handlers** (`app/api/.../route.ts`). Validación de input en ambos (no confíes en el cliente).
- Composición server→client: pasa datos serializables; mantén los Client Components en las hojas del árbol.

## Datos y caché
- Fetch de datos en Server Components (async). En Next 15 el fetch es **uncached por defecto**: opta a caché con `cache: "force-cache"`/`next: { revalidate }` cuando aplique; marca dinámico con `dynamic`/`no-store` lo que deba serlo.
- `revalidatePath`/`revalidateTag` tras mutaciones. **Streaming** con `loading.tsx` + Suspense; `error.tsx` por segmento.

## Convenciones
- `metadata`/`generateMetadata` para SEO (coordina con la skill/agente SEO). Optimiza con `next/image` y `next/font`.
- **Secretos solo en servidor**: nunca en componentes cliente ni con prefijo `NEXT_PUBLIC_` (ese prefijo expone la var al navegador). Valida envs al boot.
- Middleware (`middleware.ts`) para auth/redirect a nivel edge cuando convenga.

## Comandos
- `next dev` · `next build` · `next start` · `next lint`

## Tests
- Vitest/Jest + Testing Library para componentes; Playwright para e2e de flujos (incluye Server Actions). Mockea red (MSW).

> Aplica también el playbook común de frontend (a11y, server-state vs client-state, performance, i18n).
