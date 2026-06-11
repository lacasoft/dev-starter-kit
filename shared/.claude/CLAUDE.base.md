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

## Idioma
- **Interacción, explicaciones y documentación**: **español de México**, registro técnico neutro. Evita peninsularismos (usa *costo* no "coste", *configurar/armar* no "montar", *computadora* no "ordenador", *archivo* no "fichero").
- **Código, identificadores, mensajes de commit, logs y mensajes de error**: en **inglés** (convención de industria), salvo que `CLAUDE.project.md` indique otra cosa.
- **Textos visibles al usuario final**: siempre vía i18n, **nunca hardcodeados** (ni en español ni en inglés).

## 2. Organización de archivos

| Carpeta | Contenido |
|---------|-----------|
| `/src` | código fuente |
| `/tests` | pruebas |
| `/docs` | documentación markdown (de trabajo, gitignored) |
| `/docs/adr` | Architecture Decision Records — **versionados** (excepción a `/docs`) |
| `/config` | configuración |
| `/scripts` | utilidades |
| `/examples` | ejemplos |

Nunca en la raíz. En `.gitignore`: `/docs` (salvo `/docs/adr`, que SÍ se versiona), `.claude/memory/`, `.claude-flow/`, `.swarm/`, `*.local.*`, `.env*`. Los ADRs son historia del proyecto: deben sobrevivir un clone y verse para todos.

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
- **Nada hardcodeado**: ninguna config, URL, host, puerto, credencial, clave o flag que cambie entre entornos (dev/staging/prod) va escrita en el código. Externalízala a **variables de entorno**, declaradas en `.env` (gitignorado) con un `.env.example` versionado (solo nombres, **nunca valores**). Léelas por una **capa de config única validada al boot** (fail-fast si falta una crítica), no con `process.env.X` (o equivalente) esparcido por el código.
- Nunca loguear secretos, tokens ni PII.

## 7. Calidad

- Archivos < 500 LoC; funciones cortas y con una responsabilidad.
- Nada de código muerto ni comentado "por si acaso".
- Manejo de errores explícito; nunca tragar excepciones en silencio.
- Tests para la nueva funcionalidad y para cada regresión corregida.
- TypeScript/tipado **strict**; evita `any` (usa `unknown` + narrowing).

## 8. Completitud (no negociable)

- **Completo o nada**: entrega soluciones completas, no intermedias ni de baja calidad. Un flujo de extremo a extremo que funciona y se sostiene, nunca fragmentos ni andamiaje.
- **Sin parches ni "para después"**: prohibido `TODO`/`FIXME`, stubs, `not implemented`, funciones vacías, mocks que sustituyan lógica real, o atajos que dejen deuda silenciosa. Si lo empiezas, lo terminas.
- Trabajar incremental **no** es entregar incompleto: cada incremento es completo y funcional en sí mismo; "más adelante" es una fase con criterios, no un agujero.
- Si **no puedes completar bien** la tarea (falta contexto, una decisión o el alcance), **párate y dilo** —qué falta y por qué— en vez de entregar algo a medias que aparente estar terminado.
- Entre rápido-incompleto y completo, eliges **completo**. La calidad no se negocia para ganar velocidad.
- **Evidencia antes que afirmaciones**: no digas "pasa", "compila", "está arreglado" ni "listo" sin haber corrido la verificación **en este mismo turno** y leído su salida. Si no lo corriste, no lo afirmes (skill `verification`).

---

> Reglas específicas de lenguaje/framework: ver el `CLAUDE.md` del stack (importa este archivo con `@.claude/CLAUDE.base.md`).
