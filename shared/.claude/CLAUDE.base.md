# BASELINE UNIVERSAL — Reglas para CUALQUIER proyecto

> Esta es la capa común a todos los proyectos (backend, frontend, mobile). Cada stack
> añade su propio `CLAUDE.md` que importa este archivo y agrega particularidades.
> El objetivo es **coherencia**: cualquier desarrollo, nuevo o heredado, se comporta igual.

---

## 1. Comportamiento (no negociable)

- Haz **lo pedido; nada más, nada menos**. No agregues alcance no solicitado.
- **NUNCA** crees archivos si no son imprescindibles para el objetivo.
- **SIEMPRE** prefiere editar un archivo existente a crear uno nuevo.
- **NUNCA** crees `*.md` ni `README` proactivamente sin que se pidan.
- **NUNCA** guardes temporales, `.md` de apoyo ni tests en la raíz del repo.
- **SIEMPRE** lee un archivo antes de editarlo.
- **NUNCA** commitees secretos, credenciales ni `.env*`.
- **NUNCA** hagas `push --force` a `main`/`develop` ni uses `--no-verify` sin orden explícita.
- **NO** narres tu deliberación interna; comunica decisiones y resultados.
- Ante operaciones destructivas o que afecten estado compartido (DB, infra, despliegues, borrados): **pide confirmación** y explica el impacto.
- Reporta con honestidad: si un test falla, dilo con la salida; si saltaste un paso, dilo.

## 2. Organización de archivos

| Carpeta | Contenido |
|---------|-----------|
| `/src` | código fuente |
| `/tests` | pruebas |
| `/docs` | documentación markdown (gitignored) |
| `/config` | configuración |
| `/scripts` | utilidades |
| `/examples` | ejemplos |

Nunca en la raíz. Siempre en `.gitignore`: `/docs`, `.claude/memory/`, `.claude-flow/`, `.swarm/`, `*.local.*`, `.env*`.

## 3. Coordinación de agentes (modelo de enjambre híbrido)

El proyecto puede operar con **claude-flow** (enjambre multi-agente) cuando está instalado.
Independientemente de eso, estas reglas de coordinación aplican SIEMPRE:

- **Agentes core** (ver `.claude/agents/`):
  - `planner` → antes de toda feature grande: descompone, identifica riesgos, secuencia.
  - `researcher` → para entender código/dominio existente antes de tocar.
  - `coder` → implementación general.
  - `tester` → diseño y mantenimiento de pruebas.
  - `reviewer` → QA, correctitud y consistencia antes de cerrar.
- **Especialistas**:
  - `backend-developer` → APIs/microservicios/colas listos para producción.
  - `security-engineer` → PROACTIVO: diseño seguro, threat modeling, hardening, secretos, compliance.
  - `api-security-audit` → auditoría focalizada de APIs REST/GraphQL (OWASP API Top 10, BOLA/BFLA).
  - `penetration-tester` → testing ofensivo **solo autorizado** (rules of engagement).
  - `monitoring-specialist` → observabilidad: métricas, trazas, logs, SLO, alertas accionables.
- **Topología** (si hay claude-flow): `hierarchical-mesh`, coordinador + workers especializados.
- **Memoria compartida**: el estado entre agentes y sesiones vive en `.claude/memory/`
  (local y por-proyecto). Lo gestionan los helpers; no la inventes en otro sitio.
- **Protocolo por tarea**: (1) recuperar contexto/aprendizajes previos → (2) planificar →
  (3) ejecutar en paralelo lo independiente → (4) verificar → (5) registrar resultado.
- Tras lanzar trabajo en background o subagentes: **STOP**. No hagas polling; espera el resultado.

## 4. Concurrencia y batching

**1 MENSAJE = TODAS LAS OPERACIONES RELACIONADAS.**

- `TodoWrite`: agrupa 5-10+ items en una sola llamada.
- `Bash`/`Read`/`Write`/`Edit` independientes: en paralelo, en un solo mensaje.
- Spawning de agentes paralelos: todos los `Task`/`Agent` en un solo mensaje.
- No serialices lo que puede correr concurrente.

## 5. Git, lint y commits

- **Husky + lint-staged**: Prettier + ESLint (o el linter del stack) sobre staged.
- **Conventional Commits** (CommitLint). Tipos: `feat, fix, docs, style, refactor, perf, test, chore, revert, build, ci`.
- **Ramas**: `feat/…`, `fix/…`, `chore/…`, `ci/…`, `perf/…`, `refactor/…`, `test/…`.
- **PR**: plantilla con `## Summary` y `## Test plan` (checklist).
- Un commit = un cambio lógico coherente. Mensajes en imperativo.

## 6. Seguridad universal

- Validar input en **todos** los boundaries (DTOs, params, body, env).
- Comparaciones de credenciales con `timingSafeEqual` (nunca `==`).
- **Fail-fast** en boot si falta una env var crítica (`getOrThrow`).
- Sanitizar rutas (anti directory traversal).
- Helmet + CORS allowlist (nunca comodín `*` como origin en producción).
- Rate limiting en endpoints sensibles (auth, pagos, export).
- Secrets solo vía env vars / secret manager. Jamás en código ni en el repo.
- Nunca loguear secretos, tokens ni PII.

## 7. Calidad

- Archivos < 500 LoC; funciones cortas y con una responsabilidad.
- Nada de código muerto ni comentado "por si acaso".
- Manejo de errores explícito; nunca tragar excepciones en silencio.
- Tests para la nueva funcionalidad y para cada regresión corregida.
- TypeScript/tipado **strict**; evita `any` (usa `unknown` + narrowing).

---

> Reglas específicas de lenguaje/framework: ver el `CLAUDE.md` del stack (importa este archivo con `@.claude/CLAUDE.base.md`).
