# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

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
