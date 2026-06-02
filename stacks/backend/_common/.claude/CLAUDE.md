# Categoría: BACKEND — playbook senior (común a todo backend)

## Arquitectura
- Capas explícitas y dependencias hacia el dominio: **Controller/Route → Service (casos de uso) → Repository/Data → Schema/DTO**. El dominio no conoce a la infraestructura (hexagonal/clean).
- Módulos **por dominio** (`/src/modules/<dominio>/`), no por tipo técnico. Bounded contexts con límites claros; comunicación entre contextos por interfaces/eventos, no por acceso directo a sus tablas.
- Lógica de negocio en servicios/dominio, **nunca** en controllers ni en el ORM.

## Patrones de aplicación
- **Repository + Unit of Work** para persistencia; la transacción define el límite de consistencia.
- **Outbox** para publicar eventos de forma fiable junto a la escritura (evita doble escritura inconsistente).
- **Saga / proceso de compensación** para flujos distribuidos de larga duración.
- **CQRS ligero** solo si lecturas y escrituras divergen de verdad; no por moda.
- **Idempotencia** obligatoria en webhooks/jobs/pagos: deduplica por id de evento (clave en store con TTL); reintentos seguros.

## Datos
- Migraciones versionadas y **reversibles** (cada `up` con su `down`). Jamás alterar el esquema a mano en prod.
- **Transacciones** para operaciones multi-tabla atómicas; define el aislamiento conscientemente (locking optimista por defecto).
- Evita **N+1**: joins/eager selectivo, batching o dataloader. Mide con el log de queries.
- Índices para toda columna en `WHERE`/`JOIN`/`ORDER BY` con volumen. Paginación por **keyset** en listados grandes (no `OFFSET` profundo).

## API
- Contrato explícito: valida el request (DTO/schema) y **tipa** la respuesta. Versiona (`/v1`).
- **Envelope de error consistente**: `{ code, message, details? }`. Nunca filtres stack traces ni internals en prod.
- Paginación, filtrado y orden estandarizados. Documenta con OpenAPI/Swagger.

## Seguridad
- AuthN (quién) y AuthZ (qué) separadas y testeadas; deniega por defecto.
- Rate limiting en auth, pagos y export. `getOrThrow` para env vars al boot (fail-fast).
- Validación en todos los boundaries; nunca confíes en datos externos. Comparaciones de credenciales timing-safe.

## Observabilidad y resiliencia
- Logging estructurado (JSON) con correlación de request. **Nunca** loguees secretos ni PII.
- Health/readiness checks y métricas en endpoints críticos.
- Timeouts, reintentos con backoff y **circuit breaker** en llamadas a terceros.

## Agentes/skills recomendados (los instala el kit)
Agentes: `database-architect`, `code-reviewer`, `test-engineer`, `architect-review`. Skills: `docker-expert`, `senior-security`, `clean-code`.
