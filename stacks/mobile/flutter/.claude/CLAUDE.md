# Stack: Flutter — playbook senior (Dart)

## Base
- Dart con **null-safety estricto**. `analysis_options.yaml` con lints fuertes (`flutter_lints` o `very_good_analysis`).
- Arquitectura por capas: `presentation` (widgets) → `application`/`bloc` → `domain` → `data` (repositories).

## Gestión de estado (elige UNO en todo el proyecto)
- **Riverpod** (recomendado para nuevo) o **BLoC/Cubit**. No mezcles paradigmas; la inconsistencia es el mayor problema en bases Flutter.
- Mantén la UI tonta: el estado y la lógica viven en providers/blocs, no en `State` de widgets.

## Rendimiento de widgets (lo que evita el jank)
- `const` en todo widget que pueda serlo (corta rebuilds). Separa en **widgets** en vez de métodos `_buildX` (los métodos no se benefician de `const` ni de la diffing).
- Reconstrucciones acotadas: `Consumer`/`select` (Riverpod) o `BlocBuilder` con `buildWhen` para no reconstruir de más.
- Listas largas con `ListView.builder`/`SliverList` (lazy). Imágenes con cache (`cached_network_image`).

## Modelos y datos
- Inmutabilidad con **freezed**; serialización con `json_serializable`. Igualdad por valor.
- Repositories para datos; offline con Hive/Isar/Drift según necesidad. Navegación tipada con **go_router**.

## Particularidades móviles (ver categoría mobile)
- Offline-first, permisos explícitos, safe areas, accesibilidad del SO, secrets en `flutter_secure_storage`, diferencias de plataforma con `Theme.of(context).platform`/`Platform`.

## Comandos
- `flutter run` · `flutter build apk|ios|appbundle`
- `flutter analyze` · `dart format .`
- `flutter test` · `flutter test --coverage`
- `dart run build_runner build --delete-conflicting-outputs` (freezed/json)

## Tests
- `flutter_test` (unit + widget) e `integration_test` para flujos. Mockea repositories con `mocktail`. `golden` tests para UI estable con criterio.
