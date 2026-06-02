# Stack: Angular 20 — playbook senior (zoneless + Signals + Tailwind + ngx-translate)

## Zoneless: el cambio mental clave
- Sin Zone.js **no hay detección automática**. Modela el estado reactivo con **signals** (`signal`/`computed`/`effect`) — es el camino correcto, no el parche.
- Si recibes datos fuera del grafo reactivo de Angular (callbacks de terceros, WebSocket crudo), o usas signals, o inyecta `ChangeDetectorRef` y llama `markForCheck()`/`detectChanges()` tras mutar. Preferir signals.
- **NUNCA** apagues `isLoading` en `finalize()`: con zoneless corre en momentos no deseados. Hazlo en `next`/`error` del subscribe (o usa `toSignal`/`resource`).

## Componentes y rendimiento
- **Standalone components** (sin NgModules nuevos). `ChangeDetectionStrategy.OnPush` por defecto.
- `@if`/`@for`/`@switch` (control flow nuevo) con `track` en los `@for` (clave estable, no índice).
- `inject()` sobre constructor cuando aporte; `DestroyRef`/`takeUntilDestroyed` para limpiar suscripciones.

## RxJS con criterio
- Usa signals para estado; RxJS para flujos de eventos/async complejos. No subscribes manuales sin limpieza.
- Operadores de aplanado correctos: `switchMap` (cancela anterior, p.ej. búsqueda), `concatMap` (orden), `exhaustMap` (ignora mientras corre, p.ej. submit). Maneja el error **dentro** del stream.

## Convenciones del proyecto
- Todo texto visible vía `| translate` (ngx-translate); nunca hardcodeado.
- Nada de acceso directo a `localStorage`: usa un `StorageService` inyectable.
- Tailwind para estilos; evita CSS suelto duplicado. Sanitiza con `DomSanitizer` si inyectas HTML.

## Comandos
- `ng serve` · `ng build` · `ng test` · `ng lint`

## Tests
- Testing Library Angular o TestBed con `OnPush`. Mockea servicios HTTP (`HttpTestingController`). Prueba comportamiento visible, no internals.
