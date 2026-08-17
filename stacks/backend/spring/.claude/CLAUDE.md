# Stack: Spring Boot (Java / Kotlin)

## Estructura y DI
- Capas: `Controller` → `Service` → `Repository` (Spring Data JPA). **Inyección por constructor** (nunca `@Autowired` en campos: rompe testabilidad e inmutabilidad).
- DTOs en la API, **nunca** entidades JPA expuestas (evita fugas y problemas de serialización lazy). Mapea con MapStruct o a mano.
- DTOs como `record` (Java 17+): inmutables y con equals/hashCode correctos sin boilerplate. En Kotlin, `data class` con `val`.

## Persistencia (JPA)
- Evita **N+1**: `JOIN FETCH`, `@EntityGraph` o proyecciones; cuidado con `FetchType.EAGER`. `@Transactional` con límites claros (en el service, no en el controller).
- `@Transactional(readOnly = true)` en lecturas: habilita optimizaciones del proveedor y documenta la intención.
- Migraciones con **Flyway**/Liquibase (nunca `ddl-auto=update` en prod). Locking optimista con `@Version`.
- Cuidado con el proxy de `@Transactional`: una llamada interna al mismo bean **no** pasa por el proxy y se queda sin transacción.

## API, validación, errores
- Bean Validation (`@Valid`, `@NotNull`...) en los DTOs de entrada. Manejo global con `@RestControllerAdvice` → envelope de error consistente.
- Versionado y paginación (`Pageable`). Limita el tamaño de página en el servidor: un `size` sin tope es un DoS gratis.

## Concurrencia
- Java 21+: **virtual threads** (`spring.threads.virtual.enabled=true`) para I/O bloqueante; no los uses con código `synchronized` de bloqueo largo (pinning).
- `@Async` con un executor **explícito** (nunca el default sin acotar) y `CompletableFuture` para composición. Propaga el contexto de seguridad si lo necesitas.

## Resiliencia y caché
- **Resilience4j** para llamadas a terceros: timeout + retry con backoff + circuit breaker. Un cliente HTTP sin timeout acaba tumbando el pool.
- `@Cacheable` con clave explícita y TTL; invalida en la escritura (`@CacheEvict`). Nunca cachees respuestas que dependan del usuario sin incluirlo en la clave.

## Config y seguridad
- `application-{env}.yml` por perfil; secretos vía env vars / config server, **nunca** en el yml versionado. Fail-fast con `@ConfigurationProperties` validadas.
- **Spring Security** deny-by-default; passwords con BCrypt; authz por método/endpoint. Actuator con endpoints sensibles protegidos.

## Observabilidad
- Actuator + **Micrometer** para métricas; `/health` y `/health/readiness` diferenciados. Logging estructurado (JSON) con `traceId` correlacionado, sin secretos ni PII.

## Comandos
- Maven: `mvn spring-boot:run` · `mvn verify` — Gradle: `./gradlew bootRun` · `./gradlew test`

## Tests
- JUnit 5 + Mockito (unit), `@SpringBootTest` + **Testcontainers** (integración con DB real). `@DataJpaTest` para repos.
- Prefiere **slices** (`@WebMvcTest`, `@DataJpaTest`) al `@SpringBootTest` completo: arrancar todo el contexto en cada test es lo que vuelve lenta la suite.

> Aplica también el playbook común de backend.
