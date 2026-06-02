# Stack: FastAPI — playbook senior (Python 3.12 + SQLAlchemy 2 + Alembic + Redis)

## Async sin pies de plomo
- `async`/`await` de punta a punta (driver async: **asyncpg**). **Nunca** llames I/O bloqueante en el event loop; si una lib es sync, aíslala con `run_in_threadpool`.
- Una `AsyncSession` por request, inyectada como dependencia; no la compartas entre tareas concurrentes.

## Capas e inyección
- `routers/` → `services/` (casos de uso) → `repositories/`/`crud/` → `models/` (SQLAlchemy) + `schemas/` (Pydantic).
- `Depends()` para sesión de DB, usuario autenticado y settings. Sobre-escribe dependencias en tests (`app.dependency_overrides`).

## Validación y contrato
- **Pydantic v2**: modelos de entrada estrictos y `response_model` para la salida (no devuelvas el modelo ORM directo). `model_config` con `from_attributes=True` para mapear ORM→schema.
- Tipos precisos (`Annotated`, `Field` con constraints). Errores con envelope consistente vía exception handlers.

## Persistencia
- SQLAlchemy 2.0 estilo `select()`; carga de relaciones explícita (`selectinload`/`joinedload`) para evitar N+1 y lazy-load en async (que falla).
- Migraciones con **Alembic**: `--autogenerate` **revisado a mano** (no aplica cambios destructivos a ciegas).
- Transacciones por caso de uso; `async with session.begin()`.

## Calidad y config
- Type hints en todo; `mypy`/`pyright` strict. `ruff` para lint+format.
- Config con `pydantic-settings`; fail-fast si falta env crítica.
- Tareas en background con cuidado (`BackgroundTasks` para lo ligero; Celery/RQ/arq para lo serio e idempotente).

## Comandos
- `uvicorn app.main:app --reload`
- `alembic revision --autogenerate -m "<msg>"` · `alembic upgrade head` · `alembic downgrade -1`
- `pytest` · `pytest --cov` · `ruff check . && ruff format . && mypy .`

## Tests
- `pytest` + `httpx.AsyncClient` (ASGITransport) para endpoints. Fixtures con DB de prueba transaccional (rollback por test). `pytest-asyncio`.
