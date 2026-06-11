# Stack: Django (+ DRF)

## Estructura
- Apps por dominio (`apps/<dominio>/`), no un monolito de un solo app. `settings/` dividido (`base.py`, `dev.py`, `prod.py`).
- Lógica de negocio en services/managers, no en las views ni "fat models" sin límite.

## ORM (donde se cae el rendimiento)
- Evita **N+1**: `select_related` (FK/1-1) y `prefetch_related` (M2M/reverse). Mide con `django-debug-toolbar`/`QuerySet.explain()`.
- Migraciones versionadas; cuidado con migraciones de datos + esquema en el mismo deploy (ver skill `migration`). `transaction.atomic` para operaciones multi-tabla.
- `.only()`/`.defer()` y `bulk_create`/`bulk_update` para volumen.

## API (DRF)
- Serializers para entrada/salida (no expongas el modelo crudo). ViewSets + routers. **Permissions deny-by-default** (`IsAuthenticated` + permisos de objeto; cuida BOLA/IDOR).
- Paginación y throttling configurados.

## Seguridad y config
- `DEBUG = False` en prod, `ALLOWED_HOSTS` explícito, `SECURE_*` (SSL redirect, HSTS, cookies seguras). CSRF activo.
- `SECRET_KEY` y credenciales vía env (`django-environ`/`os.environ`), nunca en settings versionados. Fail-fast si falta una crítica.
- Async pesado con **Celery** (idempotente, con reintentos), no en el request.

## Comandos
- `python manage.py runserver|migrate|makemigrations|createsuperuser|collectstatic`
- `pytest` (pytest-django) · `ruff check . && ruff format .` · `mypy .`

## Tests
- `pytest-django` o `TestCase`; fixtures con DB de prueba. Mockea servicios externos. Cobertura de permisos y de cada bug.

> Aplica también el playbook común de backend.
