<!--
  PLANTILLA DE DEFINICIÓN DEL PROYECTO
  Rellena las secciones que apliquen y borra las que no. Esto es lo que da CONTEXTO real
  al agente (qué es el producto, su dominio, reglas y convenciones). Sin esto, el agente
  solo conoce las reglas genéricas. El root CLAUDE.md importa este archivo con @CLAUDE.project.md.
  Mantén lo esencial y actualizado; no es documentación exhaustiva, es contexto operativo.
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
<!-- Requisitos específicos: authz, PII, manejo de fondos/pagos, auditoría, normativa aplicable. -->

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

## Notas / gotchas
<!-- Trampas conocidas, deuda técnica relevante, cosas no obvias que el agente debe saber. -->
