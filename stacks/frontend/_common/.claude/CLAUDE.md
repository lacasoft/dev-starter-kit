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
- Si el producto se ofrece en la UE, la **European Accessibility Act** (exigible desde junio de 2025) lo vuelve obligación legal. Su norma de referencia, EN 301 549, se basa hoy en WCAG 2.1 AA; cumplir WCAG 2.2 AA la cubre.
- Roles/labels ARIA correctos, foco visible y manejable por teclado, contraste suficiente. Lo nuevo de WCAG 2.2: el foco no queda tapado por cabeceras fijas, alternativa a los gestos de arrastre, objetivos de al menos 24×24 px (mínimo AA; el kit pide 44 px, abajo) y sin pruebas cognitivas en el login.
- Touch targets ≥ 44px, `alt` en imágenes, labels asociadas a inputs, jerarquía de headings.

## Rendimiento (mide, no adivines)
- Elimina **waterfalls** de fetch (paraleliza, prefetch de datos críticos). Code splitting y lazy de rutas/componentes pesados.
- Memoización (`memo`/`useMemo`/computed) **solo** cuando un profiler lo justifique; memoizar por reflejo añade costo y bugs.
- Vigila el **bundle** (analiza, tree-shaking, imports puntuales). Imágenes en formato moderno y tamaños responsivos. Umbrales de Core Web Vitals (percentil 75, campo real): **LCP ≤ 2.5 s**, **INP ≤ 200 ms**, **CLS ≤ 0.1**.

## UX y diseño
- Diseño **intencional**, no "AI slop" (evita fuentes y layouts genéricos por defecto).
- Estados explícitos siempre: loading, vacío, error, éxito. Nunca dejes al usuario sin feedback.
- i18n desde el día uno: textos por sistema de traducción, nunca hardcodeados.

## Seguridad cliente (ASVS 5.0 V3)
- Solo claves **públicas** en el cliente; jamás secretos.
- **CSP** estricta (sin `unsafe-inline`; nonces o hashes) y, donde el navegador lo soporte, Trusted Types para cerrar XSS por DOM. Cookies de sesión `Secure`, `HttpOnly` y `SameSite`.
- Sanitiza HTML antes de inyectarlo (XSS); no confíes en datos del backend para `innerHTML`/`[innerHTML]`.

## Agentes/skills recomendados (los instala el kit)
Agentes: `frontend-developer`, `ui-ux-designer`, `code-reviewer`. Skills: `frontend-design`, `ui-design-system`, `senior-frontend`, `clean-code`. Herramienta: `react-doctor` (en React).
