# Stack: .NET / ASP.NET Core (C#)

## Estructura y DI
- Minimal APIs o Controllers; capas con el **contenedor DI integrado** (constructor injection). Lifetimes correctos (`Scoped` para EF DbContext, no `Singleton`).
- DTOs/`record` en la API, **nunca** entidades EF expuestas. Mapea con Mapster/AutoMapper o a mano.

## Persistencia (EF Core)
- Lecturas con `AsNoTracking()`. Evita **N+1**: `Include`/`ThenInclude` o proyecciones a DTO con `Select`. `await` en todo I/O.
- Migraciones con `dotnet ef migrations`; transacciones explícitas para operaciones multi-tabla. Concurrencia optimista con `[Timestamp]`/rowversion.

## API, validación, errores
- Validación con **FluentValidation** o DataAnnotations en el boundary. Manejo global con middleware de excepciones → `ProblemDetails` (RFC 7807) consistente.
- Versionado de API y paginación.

## Config y seguridad
- Config por `appsettings.{Environment}.json` + env vars + **user-secrets** en dev; secretos nunca versionados (usa Key Vault/secret manager en prod). **Options pattern** validado al boot.
- Auth con ASP.NET Core Identity/JWT; **authorization policies deny-by-default**. Logging estructurado con **Serilog** (sin secretos/PII).

## Comandos
- `dotnet run` · `dotnet build` · `dotnet test` · `dotnet format`
- `dotnet ef migrations add <N>` · `dotnet ef database update`

## Tests
- **xUnit** + Moq (unit); `WebApplicationFactory` (integración) + Testcontainers para DB real.

> Aplica también el playbook común de backend.
