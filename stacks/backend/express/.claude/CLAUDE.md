# Stack: Node.js + Express/Fastify (TypeScript)

## Estructura
- Capas: `routes` → `controllers` → `services` (casos de uso) → `repositories`/`data`. La lógica de negocio en services, no en los handlers.
- TypeScript strict. Inyección de dependencias explícita (no singletons globales). Módulos por dominio.

## Express/Fastify correcto
- **Orden de middleware** importa: parsers → seguridad (helmet, cors allowlist) → rate limiting → rutas → **manejador de errores al final** (4 args en Express).
- **Errores async**: en Express 4, envuelve los handlers async (wrapper `asyncHandler` o `express-async-errors`) o los rejections se pierden. En Fastify es nativo. Nunca dejes un `await` sin try/catch o wrapper.
- Validación de input con **zod**/joi en el boundary (params/query/body). Respuesta de error con envelope `{ code, message, details? }`.

## Config, seguridad, operación
- Config por env validada al boot (zod/envalid), fail-fast. Secretos solo vía env/secret manager.
- Helmet, CORS allowlist, rate limiting en auth/pagos. Prepared statements / query builder (anti-inyección). AuthN/AuthZ deny-by-default.
- Logging estructurado (**pino**) con correlation id, sin secretos/PII. Health/readiness checks. **Graceful shutdown** (cierra servidor + pool + colas).

## Comandos
- `npm run dev` (tsx/nodemon) · `npm run build` (tsc) · `npm start` · `npm run lint`
- `npm test`

## Tests
- Vitest/Jest + **supertest** para endpoints. DB de prueba transaccional. Mockea solo dependencias externas.

> Aplica también el playbook común de backend (capas, idempotencia, N+1, observabilidad, seguridad).
