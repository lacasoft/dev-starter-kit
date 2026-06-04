# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

## [1.3.0] - 2026-06-04

### Added
- **Flag `--update` (alias `--force`)** en el instalador: actualiza un proyecto ya instalado **sobrescribiendo** la capa base (agentes, skills, helpers, comandos, `CLAUDE.base.md`) con la última versión del kit. Hace backup antes, **conserva** la memoria (`.claude/memory/`) y `CLAUDE.project.md`, y **respeta** el `settings.json` de claude-flow si está presente. Sin el flag, el instalador sigue siendo aditivo (skip-existing) como hasta ahora.

## [1.2.0] - 2026-06-04

Integración de 5 fuentes externas (MIT / Apache-2.0) revisadas a fondo y destiladas a la capa base en español. Ver `components.json` → `distilled` para la atribución completa.

### Added
- **3 skills nuevas**: `verification` (gate de evidencia antes de declarar hecho), `git-worktrees` (workspace aislado sin pelear con el harness), `code-review-response` (responder a una revisión con rigor técnico, sin acuerdo performativo). Destiladas de [Superpowers](https://github.com/obra/superpowers) (MIT).
- **CWE Top 25 + OWASP 2025** en `agents/security-engineer.md` (con las categorías nuevas A03 Supply Chain y A10 Mishandling of Exceptional Conditions) y **CI/CD security de GitHub Actions** en `skills/ship-gate`. Destilado de [Cyber Neo](https://github.com/Hainrixz/cyber-neo) (MIT).
- **Context7** referenciado como plugin/MCP opcional (shared) en `components.json` + instrucción anti-alucinación de APIs en `agents/researcher.md`. De [Context7](https://github.com/upstash/context7) (MIT).
- **Diseño** — `agents/ui-designer.md` enriquecido: registro **marca vs producto**, catálogo concreto de **AI-slop**, eje de estrategia de color, técnicas de interacción modernas (Popover API/CSS Anchor/`inert`), "cuándo NO animar", brief→design system oficial y pre-flight visual. Destilado de [Impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0, deriva de `anthropics/frontend-design`) y [Taste Skill](https://github.com/leonxlnx/taste-skill) (MIT). `impeccable` también referenciado como plugin opcional (frontend). **`emilkowalski/skill` NO integrado** (sin licencia → no destilable); ver `components.json` → `discarded`.

### Changed
- **Scanner de secretos** (`helpers/hook-handler.cjs`): de 3 a ~30 patrones por proveedor (AWS/GCP/GitHub/Slack/Stripe/OpenAI/Anthropic/DB URLs/claves privadas…) **con allowlist** de placeholders y claves de test, reduciendo falsos positivos.
- **§8 Completitud** de `CLAUDE.base.md`: añade el gate "evidencia antes que afirmaciones" (no digas "pasa/compila/listo" sin correr la verificación en el turno).
- **§6 Seguridad** de `CLAUDE.base.md` + `agents/coder.md`: regla **"nada hardcodeado"** — toda config/URL/host/puerto/clave/flag que cambie entre entornos va a variables de entorno (`.env` gitignorado + `.env.example` versionado, solo nombres), leída por una capa de config validada al boot (fail-fast), no incrustada en el código.
- **`skills/tdd`**: Ley de hierro + tabla de racionalizaciones. **`skills/diagnose`**: circuit-breaker de 3 hipótesis (≥3 arreglos fallidos = problema de arquitectura) + instrumentación por capas. **`skills/swarm-orchestration`**: patrón subagent-driven secuencial (doble review + estados). **`skills/handoff`**: vocabulario de estados.
- **Regla CSO** en `CONTRIBUTING.md` (la `description` dice solo *cuándo*, no el workflow) aplicada a las descriptions de `swarm-orchestration`, `release` y `migration`.

## [1.1.0] - 2026-06-03

### Added
- **Estándar de completitud (no negociable)** en los 14 agentes: prohíbe soluciones intermedias o de baja calidad, parches, `TODO`/stubs/`not implemented`/mocks que sustituyan lógica real y atajos "para después"; exige un flujo completo de extremo a extremo y detenerse y avisar cuando no se pueda completar bien. Cada agente incluye su definición de "completo" en su dominio (especialización).
- **Sección 8 "Completitud (no negociable)"** en `CLAUDE.base.md`: misma regla a nivel de baseline universal, heredada por el hilo principal y todos los overlays de stack.

## [1.0.1] - 2026-06-03

Correcciones de robustez en el instalador, los hooks y la statusline. Sin cambios de comportamiento para el usuario.

### Fixed
- **Guard `rm -rf`**: ahora también bloquea `rm -rf /*` (antes solo `/`, `~`, `$HOME` seguidos de espacio/`/`/fin).
- **Detección de stack**: eliminada cláusula muerta en React Native (`app.json && deps["react-native"]`, redundante por precedencia). La detección se mantiene por `react-native`/`expo`.
- **Statusline**: el contador de memoria (🧠) se resuelve relativo al helper (`.claude/memory/`) en vez de al `cwd`, así no marca 0 al trabajar desde un subdirectorio.
- **`--dry-run`**: `CLAUDE.project.md` y `CLAUDE.md` se rotulan con prefijo `(dry-run)` y el preview refleja el import real `@CLAUDE.project.md` (antes simulaba escrituras como reales y omitía el import).

### Changed
- **`settings.json`**: eliminada la clave no-estándar `claudeFlow` (no la lee ningún consumidor; la config viva de claude-flow está en `components.json`) y el permiso redundante `Bash(npx @claude-flow*)`. Corregido el wildcard MCP a `mcp__claude-flow__*`. La topología del enjambre sigue documentada en `CLAUDE.base.md` y `env.CLAUDE_FLOW_HOOKS_ENABLED` permanece.

## [1.0.0] - 2026-06-02

Primera versión estable del Dev Starter Kit (arquitectura de archivos reales + instalador).

### Added
- **Instalador** `install.js` (bin `lacasoft-kit`): detecta stack, aplica la capa base, compone
  `CLAUDE.md` (project + base + común + stack), actualiza `.gitignore`, orquesta claude-flow (opcional),
  instala externos curados (opcional) e indica plugins. Flags: `--stack`, `--yes`, `--all`, `--no-flow`,
  `--no-external`, `--dry-run`, `--help`.
- **Capa base** `shared/.claude/`: `CLAUDE.base.md`, `settings.json` (9 hooks + statusLine + claudeFlow),
  helpers funcionales zero-dep (hook-handler, memory, session, router, intelligence, statusline, auto-memory).
- **14 agentes** expertos (español): core (planner, researcher, coder, tester, reviewer) +
  especialistas (backend-developer, security-engineer, api-security-audit, penetration-tester,
  monitoring-specialist, api-architect, ui-designer, seo-specialist, ux-researcher).
- **12 skills**: flujo (tdd, diagnose, grill-me, handoff, swarm-orchestration) + ingeniería
  (ci-cd, performance-profiling, migration, monorepo, release, ship-gate, iac), estas últimas
  destiladas de [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) (MIT).
- **Overlays por stack**: backend (nestjs, fastapi, php), frontend (angular, react),
  mobile (react-native, flutter), blockchain (solidity), con `_common` por categoría.
- **Modelo de memoria** por-proyecto en `.claude/memory/` (autogitignoreado) + `CLAUDE.project.md`
  (plantilla de definición del proyecto importada por `CLAUDE.md`).
- **Enjambre híbrido**: orquesta claude-flow si se instala; coordinación nativa si no.
- **components.json**: manifiesto curado de externos (claude-code-templates, plugins, npm) con motivos.
- **scripts/validate.cjs** + CI: validación zero-dep de frontmatter, JSON y sintaxis.

### Notes
- Distribución por `npx github:lacasoft/dev-starter-kit` (privado). `master` debe estar siempre verde.
