# Stack: NestJS — playbook senior (TypeScript + TypeORM + PostgreSQL + Redis)

## Estructura de módulo
- DDD con bounded contexts en `/src/modules/<dominio>/`. Cada módulo expone: `*.controller`, `*.service` (caso de uso), `*.repository`, `*.dto`, `*.entity`, y sus `*.spec`.
- Un módulo = un contexto cohesivo. Exporta solo lo necesario; no compartas repositories entre módulos (cruza por servicios/eventos).

## DI y ciclo de vida
- Inyección por constructor siempre. Cuida el **scope** de providers (`DEFAULT` singleton vs `REQUEST`): un provider `REQUEST` contamina a sus consumidores y mata el rendimiento.
- Cross-cutting con el orden correcto: **Guards** (authz) → **Interceptors** (logging/transform/cache) → **Pipes** (validación/transformación) → **Exception Filters** (envelope de error).

## Validación y contrato
- DTOs con `class-validator` + `class-transformer`. `ValidationPipe` global con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Nunca expongas la entity como respuesta: usa DTO de salida o `class-transformer` con `@Exclude()`/`@Expose()` (cuidado con PII).

## Persistencia (TypeORM)
- Repository pattern; lógica en services. Para queries complejas usa `QueryBuilder` (evita el N+1 de relaciones lazy).
- Transacciones con `DataSource.transaction()` o `QueryRunner`; define el límite por caso de uso. Locking optimista con `@VersionColumn`.
- Migraciones generadas y **revisadas a mano** (`migration:generate`), nunca `synchronize: true` en prod.

## Config, seguridad, async
- Config validada con Joi al boot; acceso vía `ConfigService.getOrThrow`. Fail-fast si falta una crítica.
- `@nestjs/throttler` para rate limiting. Helmet + CORS allowlist desde env. Guards de auth (JWT access/refresh) testeados.
- Trabajo asíncrono con BullMQ; jobs **idempotentes** y con reintentos/backoff. Nada de trabajo pesado en el request.

## Comandos
- `npm run start:dev` · `build` · `lint`
- `npm run migration:generate -- <Nombre>` · `migration:run` · `migration:revert`
- `npm run test` · `test:e2e` · `test:cov`

## Tests
- TDD London (mocks de colaboradores) para services. e2e con `@nestjs/testing` + DB de prueba (transacción con rollback por test). No mockees lo que pruebas.
