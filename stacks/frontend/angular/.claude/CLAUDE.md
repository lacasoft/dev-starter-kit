# Stack: Angular 20 — playbook senior (zoneless + Signals + Tailwind + ngx-translate)

## Zoneless: el cambio mental clave
- Sin Zone.js **no hay detección automática**. Modela el estado reactivo con **signals** (`signal`/`computed`/`effect`) — es el camino correcto, no el parche.
- Si recibes datos fuera del grafo reactivo de Angular (callbacks de terceros, WebSocket crudo), o usas signals, o inyecta `ChangeDetectorRef` y llama `markForCheck()`/`detectChanges()` tras mutar. Preferir signals.
- **NUNCA** apagues `isLoading` en `finalize()`: con zoneless corre en momentos no deseados. Hazlo en `next`/`error` del subscribe (o usa `toSignal`/`resource`).

## Componentes y rendimiento
- **Standalone components** (sin NgModules nuevos). `ChangeDetectionStrategy.OnPush` por defecto.
- `@if`/`@for`/`@switch` (control flow nuevo) con `track` en los `@for` (clave estable, no índice).
- `inject()` sobre constructor cuando aporte; `DestroyRef`/`takeUntilDestroyed` para limpiar suscripciones.
- `@defer` para diferir lo que no es visible de entrada (bloques pesados, below the fold), con `@placeholder`/`@loading`.
- `effect()` es para sincronizar con el mundo exterior, **no** para derivar estado: si calculas un valor a partir de otros, eso es `computed`.

## Estado con signals
- `computed` para todo lo derivado; nada de duplicar estado que puedas calcular.
- `linkedSignal` cuando un estado local deba reinicializarse al cambiar su origen (p. ej. la selección al cambiar de lista).
- Las APIs `resource`/`rxResource`/`httpResource` cubren carga asíncrona declarativa con estado y recarga; confirma su nivel de estabilidad contra la versión exacta de tu proyecto antes de apoyarte en ellas.

## Rutas
- Lazy loading con `loadComponent`/`loadChildren` por ruta: el bundle inicial solo debe traer la primera pantalla.
- Guards y resolvers **funcionales** (`CanActivateFn`, `ResolveFn`) con `inject()`; los basados en clase son legado.
- `withComponentInputBinding()` para recibir parámetros de ruta como inputs en vez de leer `ActivatedRoute` a mano.

## HTTP y formularios
- Interceptores **funcionales** (`HttpInterceptorFn`) para auth, correlación y reintentos; el manejo de errores va en el stream, no en cada componente.
- Formularios **reactivos y tipados**; template-driven solo para casos triviales. Valida en el `FormGroup`, no en el template.

## RxJS con criterio
- Usa signals para estado; RxJS para flujos de eventos/async complejos. No subscribes manuales sin limpieza.
- Operadores de aplanado correctos: `switchMap` (cancela anterior, p.ej. búsqueda), `concatMap` (orden), `exhaustMap` (ignora mientras corre, p.ej. submit). Maneja el error **dentro** del stream.

## Convenciones del proyecto
- Todo texto visible vía `| translate` (ngx-translate); nunca hardcodeado.
- Nada de acceso directo a `localStorage`: usa un `StorageService` inyectable.
- Tailwind para estilos; evita CSS suelto duplicado. Sanitiza con `DomSanitizer` si inyectas HTML.
- Accesibilidad como requisito: HTML semántico, foco visible y navegable por teclado, `aria-*` solo cuando el elemento nativo no alcanza.
- `NgOptimizedImage` (`ngSrc`) para imágenes: dimensiona, prioriza el LCP y evita layout shift.

## Comandos
- `ng serve` · `ng build` · `ng test` · `ng lint`

## Tests
- Testing Library Angular o TestBed con `OnPush`. Mockea servicios HTTP (`HttpTestingController`). Prueba comportamiento visible, no internals.

## Presupuesto de bundle
- Mantén los `budgets` del `angular.json` y trátalos como error en CI: sin tope, el bundle solo crece.
