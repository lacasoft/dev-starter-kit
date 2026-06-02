# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

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
- Distribución por `npx github:lacasoft/dev-starter-kit` (privado). `main` debe estar siempre verde.
