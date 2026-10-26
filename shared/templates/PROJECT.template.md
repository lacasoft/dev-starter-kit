<!--
  PLANTILLA DE DEFINICIÓN DEL PROYECTO
  La forma rápida de rellenarla: abre Claude Code y corre /project-context. Lee el repo,
  confirma los comandos y te pregunta solo lo que no se puede deducir.
  Si diseñaste el sistema con system-design-kit: /project-context <ruta>/design.md traslada
  requisitos, escala, arquitectura y fallas, y crea los ADRs desde las decisiones.
  Rellena las secciones que apliquen y borra las que no. Esto es lo que da CONTEXTO real
  al agente (qué es el producto, su dominio, reglas y convenciones). Sin esto, el agente
  solo conoce las reglas genéricas. El root CLAUDE.md importa este archivo con @CLAUDE.project.md.
  Mantén lo esencial y actualizado (< 150 líneas): se carga en cada sesión.
-->

# {{NOMBRE_DEL_PROYECTO}} — Definición para Claude

## Visión del producto
<!-- Qué es, para quién, qué problema resuelve. 2-4 líneas. -->

## Modelo / dominio
<!-- Conceptos clave del dominio y su significado. Términos y jerga propios (glosario corto). -->

## Stack tecnológico
<!-- Lenguajes, frameworks, versiones. Linter/formatter REAL del repo (p.ej. Biome vs ESLint+Prettier).
     Gestor de paquetes (npm/pnpm/yarn), monorepo (Turborepo/Nx) o no. -->

## Estructura del repositorio
<!-- Carpetas/paquetes principales y qué hace cada uno. En monorepo: lista los packages y su stack.
     Ej:
     - packages/api        backend (NestJS)
     - packages/dashboard  frontend (React)
     - packages/contracts  Solidity (forge)
     - packages/sdk-*      SDKs por lenguaje (mantener API consistente entre ellos)
-->

## Arquitectura
<!-- Estilo (capas, hexagonal, DDD), bounded contexts, límites de servicio, flujos principales. -->

## Reglas de negocio (invariantes)
<!-- Las reglas que NUNCA se deben violar. Lo que el agente debe respetar sí o sí.
     Ej: idempotencia de webhooks, máquinas de estado válidas, límites, multi-tenant isolation. -->

## Seguridad y compliance
<!-- Nivel ASVS 5.0 objetivo: L1 (mínimo) · L2 (auth, datos personales, pagos) · L3 (crítico).
     Requisitos específicos: authz, PII, manejo de fondos/pagos, auditoría, normativa aplicable.
     ¿Usa LLMs o agentes? Dilo: activa las listas OWASP de LLM y agentes. -->

## Atributos de calidad
<!-- Solo los que importan aquí, con umbral medible (vocabulario ISO/IEC 25010:2023).
     Ej: eficiencia de desempeño: p95 < 300 ms en /checkout · fiabilidad: 99.9 % mensual. -->

## Integraciones externas
<!-- Servicios de terceros (pagos, email, storage, on-chain) y reglas para usarlos. -->

## Convenciones de código
<!-- Naming, organización, límites por archivo, patrones obligatorios/prohibidos propios del repo. -->

## Comandos principales
<!-- Los comandos REALES del proyecto: dev, build, test, lint, migraciones, deploy.
     En monorepo, los de turbo/nx y los de cada package. -->

## Despliegue / infraestructura
<!-- Dónde y cómo se despliega (fly.io, AWS, Docker), entornos, CI/CD relevante. -->

## Variables de entorno críticas
<!-- Las imprescindibles (solo nombres, NUNCA valores). Cuáles hacen fail-fast en boot. -->

## Testing
<!-- Frameworks, dónde viven los tests, umbral de cobertura, comandos. -->

## Decisiones de arquitectura
<!-- No las narres aquí: viven en docs/adr/ (skill adr). Enlaza las que cambian cómo se trabaja.
     Ej: - Eventos con outbox, nunca publicación directa → docs/adr/0003-outbox.md -->

## Notas / gotchas
<!-- Trampas conocidas, deuda técnica relevante, cosas no obvias que el agente debe saber. -->
