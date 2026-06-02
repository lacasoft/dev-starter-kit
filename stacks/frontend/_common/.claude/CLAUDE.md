# Categoría: FRONTEND — playbook senior (común a todo frontend web)

## Arquitectura de componentes
- Componentes pequeños, una responsabilidad. Lógica reutilizable en hooks/composables/servicios, no copiada.
- Separación de **contenedor (datos/estado) vs presentación (UI pura)**. Los presentacionales no llaman APIs.
- Tipado strict; props y respuestas de API tipadas. Nada de `any`.

## Estado (la decisión que más se equivoca)
- **Server-state** (datos del backend) ≠ **client-state** (UI local). No los mezcles en el mismo store.
- Server-state: TanStack Query / RTK Query / Resource — con cache, revalidación, estados de carga/error gestionados.
- Client-state: signals/store ligero (Zustand/Pinia/Signals). Deriva, no dupliques: estado mínimo + valores computados.

## Accesibilidad (no opcional, WCAG 2.2 AA)
- Roles/labels ARIA correctos, foco visible y manejable por teclado, contraste suficiente.
- Touch targets ≥ 44px, `alt` en imágenes, labels asociadas a inputs, jerarquía de headings.

## Rendimiento (mide, no adivines)
- Elimina **waterfalls** de fetch (paraleliza, prefetch de datos críticos). Code splitting y lazy de rutas/componentes pesados.
- Memoización (`memo`/`useMemo`/computed) **solo** cuando un profiler lo justifique; memoizar por reflejo añade coste y bugs.
- Vigila el **bundle** (analiza, tree-shaking, imports puntuales). Imágenes en formato moderno y tamaños responsivos. Apunta a buen LCP/INP/CLS.

## UX y diseño
- Diseño **intencional**, no "AI slop" (evita fuentes y layouts genéricos por defecto).
- Estados explícitos siempre: loading, vacío, error, éxito. Nunca dejes al usuario sin feedback.
- i18n desde el día uno: textos por sistema de traducción, nunca hardcodeados.

## Seguridad cliente
- Solo claves **públicas** en el cliente; jamás secretos.
- Sanitiza HTML antes de inyectarlo (XSS); no confíes en datos del backend para `innerHTML`/`[innerHTML]`.

## Agentes/skills recomendados (los instala el kit)
Agentes: `frontend-developer`, `ui-ux-designer`, `code-reviewer`. Skills: `frontend-design`, `ui-design-system`, `senior-frontend`, `clean-code`. Herramienta: `react-doctor` (en React).
