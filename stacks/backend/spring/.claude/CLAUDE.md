# Stack: Spring Boot (Java / Kotlin)

## Estructura y DI
- Capas: `Controller` → `Service` → `Repository` (Spring Data JPA). **Inyección por constructor** (nunca `@Autowired` en campos: rompe testabilidad e inmutabilidad).
- DTOs en la API, **nunca** entidades JPA expuestas (evita fugas y problemas de serialización lazy). Mapea con MapStruct o a mano.

## Persistencia (JPA)
- Evita **N+1**: `JOIN FETCH`, `@EntityGraph` o proyecciones; cuidado con `FetchType.EAGER`. `@Transactional` con límites claros (en el service, no en el controller).
- Migraciones con **Flyway**/Liquibase (nunca `ddl-auto=update` en prod). Locking optimista con `@Version`.

## API, validación, errores
- Bean Validation (`@Valid`, `@NotNull`...) en los DTOs de entrada. Manejo global con `@RestControllerAdvice` → envelope de error consistente.
- Versionado y paginación (`Pageable`).

## Config y seguridad
- `application-{env}.yml` por perfil; secretos vía env vars / config server, **nunca** en el yml versionado. Fail-fast con `@ConfigurationProperties` validadas.
- **Spring Security** deny-by-default; passwords con BCrypt; authz por método/endpoint. Actuator con endpoints sensibles protegidos.

## Comandos
- Maven: `mvn spring-boot:run` · `mvn verify` — Gradle: `./gradlew bootRun` · `./gradlew test`

## Tests
- JUnit 5 + Mockito (unit), `@SpringBootTest` + **Testcontainers** (integración con DB real). `@DataJpaTest` para repos.

> Aplica también el playbook común de backend.
