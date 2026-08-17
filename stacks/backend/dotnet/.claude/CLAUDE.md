# Stack: .NET / ASP.NET Core (C#)

## Estructura y DI
- Minimal APIs o Controllers; capas con el **contenedor DI integrado** (constructor injection). Lifetimes correctos (`Scoped` para EF DbContext, no `Singleton`).
- DTOs/`record` en la API, **nunca** entidades EF expuestas. Mapea con Mapster/AutoMapper o a mano.
- Con Minimal APIs, agrupa por dominio (`MapGroup`) y aplica filtros por grupo en vez de repetir validación endpoint por endpoint.
- **Nunca** captures un servicio `Scoped` desde uno `Singleton`: es el bug de lifetime clásico y explota tarde, en producción.

## Persistencia (EF Core)
- Lecturas con `AsNoTracking()`. Evita **N+1**: `Include`/`ThenInclude` o proyecciones a DTO con `Select`. `await` en todo I/O.
- Migraciones con `dotnet ef migrations`; transacciones explícitas para operaciones multi-tabla. Concurrencia optimista con `[Timestamp]`/rowversion.
- Proyecta a DTO **dentro** de la query (`Select` antes de materializar): traer la entidad entera para usar dos columnas es el desperdicio más común.

## Async y cancelación
- `CancellationToken` en toda firma async, propagado hasta EF y `HttpClient`: sin él, el trabajo sigue corriendo después de que el cliente se fue.
- Nada de `.Result`/`.Wait()` (deadlock) ni `async void` fuera de event handlers. `IAsyncEnumerable` para streaming en vez de materializar listas grandes.

## API, validación, errores
- Validación con **FluentValidation** o DataAnnotations en el boundary. Manejo global con middleware de excepciones → `ProblemDetails` (RFC 7807) consistente.
- Versionado de API y paginación, con tope de tamaño de página en el servidor.

## Resiliencia y caché
- `IHttpClientFactory` con **typed clients**: nunca `new HttpClient()` (agota sockets y no refresca DNS). Añade timeout + retry con backoff + circuit breaker (`Microsoft.Extensions.Http.Resilience` o Polly).
- `HybridCache`/`IMemoryCache` con TTL explícito; incluye en la clave todo lo que varíe la respuesta (usuario, tenant, cultura).

## Config y seguridad
- Config por `appsettings.{Environment}.json` + env vars + **user-secrets** en dev; secretos nunca versionados (usa Key Vault/secret manager en prod). **Options pattern** validado al boot (`ValidateOnStart`).
- Auth con ASP.NET Core Identity/JWT; **authorization policies deny-by-default**. Logging estructurado con **Serilog** (sin secretos/PII).

## Observabilidad
- **OpenTelemetry** para trazas y métricas; health checks (`/health/live`, `/health/ready`) diferenciados y conectados al orquestador.

## Calidad del proyecto
- `<Nullable>enable</Nullable>` y `<TreatWarningsAsErrors>true</TreatWarningsAsErrors>` en el `.csproj`; `.editorconfig` con analyzers. `dotnet format` en el hook de pre-commit.

## Comandos
- `dotnet run` · `dotnet build` · `dotnet test` · `dotnet format`
- `dotnet ef migrations add <N>` · `dotnet ef database update`

## Tests
- **xUnit** + Moq (unit); `WebApplicationFactory` (integración) + Testcontainers para DB real.
- Reemplaza dependencias externas en el `WebApplicationFactory` vía `ConfigureTestServices`, no con banderas de entorno dentro del código de producción.

> Aplica también el playbook común de backend.
