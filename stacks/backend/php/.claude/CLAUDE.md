# Stack: PHP 8+ — playbook senior (PSR + Composer)

## Base no negociable
- `declare(strict_types=1);` en **todos** los archivos.
- Type hints en parámetros, retornos y propiedades (incluye `readonly` para inmutabilidad). Sin tipos = no se acepta.
- PSR-12 (estilo) + PSR-4 (autoload). Enums nativos y constructor property promotion (PHP 8.1+).

## Arquitectura
- Capas: Controller/Action → Service (caso de uso) → Repository → Entity/DTO. Inyección de dependencias vía contenedor (PSR-11), no `new` disperso ni singletons globales.
- Si hay framework (Laravel/Symfony), respeta sus idioms; en vanilla, PSR-7/PSR-15 para HTTP y middlewares.

## Datos y seguridad
- **PDO con prepared statements** siempre; jamás concatenar input en SQL. `PDO::ERRMODE_EXCEPTION`.
- Transacciones para operaciones multi-tabla. Migraciones versionadas (Doctrine Migrations/Phinx).
- Validación de input con librería dedicada o `filter_input`; nunca confíes en `$_GET`/`$_POST` crudos. Hashing con `password_hash`/`password_verify`. Secretos vía env (`vlucas/phpdotenv`).

## Errores y calidad
- Excepciones **tipadas** y jerarquía propia de dominio; nunca `@` para silenciar ni `catch` vacíos.
- **PHPStan/Psalm** en nivel alto (objetivo: max). `php-cs-fixer` para formato.

## Comandos
- `composer install` · `composer dump-autoload`
- `vendor/bin/phpunit` · `vendor/bin/phpstan analyse` · `vendor/bin/php-cs-fixer fix` · `vendor/bin/phpcs`

## Tests
- PHPUnit. Mocks solo para dependencias externas. Cobertura de la lógica de negocio y de cada bug corregido.
