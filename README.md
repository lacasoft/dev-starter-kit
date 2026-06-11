# Dev Starter Kit — base coherente de Claude para todos los proyectos

Configuración `.claude` unificada para backend, frontend, mobile y blockchain. El objetivo es
**coherencia**: una capa base común a todos los proyectos + particularidades por stack, con un
**enjambre híbrido** (claude-flow cuando está, coordinación nativa cuando no).

## Estructura

```
.
├── install.js                  # instalador: detecta stack, aplica capa base, orquesta externos
├── components.json             # manifiesto curado de componentes externos (revisados 1 a 1)
├── shared/.claude/             # CAPA BASE (común a todos los proyectos)
│   ├── CLAUDE.base.md          # baseline universal (comportamiento, swarm, seguridad, calidad)
│   ├── settings.json           # hooks + permisos + statusLine
│   ├── agents/                 # core: planner, coder, reviewer, tester, researcher (reglas reales)
│   ├── skills/                 # 15 skills (flujo + ingeniería) — ver "Skills incluidas"
│   ├── commands/               # /swarm, /kit:status
│   ├── helpers/                # hook-handler, memory, session, router, intelligence, statusline
│   └── templates/              # PROJECT.template.md (definición del proyecto)
├── stacks/                     # OVERLAYS por categoría/stack
│   ├── backend/{_common,nestjs,fastapi,php}
│   ├── frontend/{_common,angular,react}
│   ├── mobile/{_common,react-native,flutter}
│   └── blockchain/solidity
└── README.md
```

## Uso

Dentro de **cualquier proyecto** (nuevo o heredado), sin clonar nada:

```bash
npx github:lacasoft/dev-starter-kit            # interactivo
npx github:lacasoft/dev-starter-kit --yes --all   # desatendido (todo)
npx github:lacasoft/dev-starter-kit#v1.2.0     # fijar una versión (tag)
```

Toma siempre la última versión de `master` (o el tag indicado). Repo **público (MIT)**.

Alternativa (clone local):

```bash
node /ruta/al/kit/install.js
```

Flags: `--stack backend/nestjs` (fuerza stack) · `--yes` (no interactivo, conservador) ·
`--all` (acepta TODO: flow + externos + deps; combínalo con `--yes` para desatendido total) ·
`--no-flow` · `--no-external` · `--update`/`--force` (sobrescribe la capa base con la última versión) · `--dry-run` (simula) · `--help`.

El instalador:
1. **Detecta el stack** (pubspec→flutter, react-native, angular.json, nest-cli, foundry, composer, fastapi, react).
2. Hace **backup** de tu `.claude/` si existe.
3. Aplica la **capa base** (`shared/.claude` → `.claude/`): agentes, skills, helpers, settings, comandos.
4. Scaffolda **`CLAUDE.project.md`** y compone **`./CLAUDE.md`** = `@CLAUDE.project.md` + `@.claude/CLAUDE.base.md` + común + stack (bloque gestionado idempotente).
5. Actualiza **`.gitignore`** (memoria/runtime/backups/secretos), idempotente.
6. (opcional) Ejecuta **`claude-flow init`** para el enjambre real (primero; la capa va encima sin pisarlo).
7. (opcional) Instala **agentes/skills externos** curados vía `claude-code-templates` y deps npm por stack.
8. Indica los **plugins de Claude Code** a añadir (shared + por-stack).

## Agentes incluidos (capa base, profundidad experta)

**Core**: `planner` · `researcher` · `coder` · `tester` · `reviewer`
**Especialistas**: `backend-developer` · `security-engineer` · `api-security-audit` · `penetration-tester` (solo autorizado) · `monitoring-specialist` · `api-architect` · `ui-designer` · `seo-specialist` · `ux-researcher`

En modo claude-flow se omiten solo los 5 core (los cubre `agents/core/*` de claude-flow); los especialistas se conservan. Además, el kit instala por stack agentes/skills externos curados (`frontend-developer`, `database-architect`, `test-engineer`, etc.) vía claude-code-templates.

## Skills incluidas (capa base)

**Flujo de trabajo**: `tdd` · `diagnose` · `grill-me` · `handoff` · `swarm-orchestration` · `verification` · `code-review-response` · `git-worktrees`
**Ingeniería/entrega**: `ci-cd` · `performance-profiling` · `migration` · `monorepo` · `release` · `ship-gate` · `iac`

Las de ingeniería se destilaron (en español, a nuestra profundidad) del catálogo MIT
[alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) (330+ skills).
Para más, su marketplace es una fuente opcional: `/plugin marketplace add alirezarezvani/claude-skills`
(cherry-pick por dominio; no instalar en bloque — ver `components.json`).

## Definición del proyecto (contexto real)

La capa base son reglas **genéricas**. Para que el agente entienda *este* producto en concreto,
el instalador scaffolda **`CLAUDE.project.md`** (desde `shared/templates/PROJECT.template.md`) y el
`CLAUDE.md` raíz lo importa con `@CLAUDE.project.md`. Rellénalo con: visión, dominio, stack real
(p.ej. Biome vs ESLint), estructura del repo (**en monorepo, lista los packages y su stack**),
arquitectura, reglas de negocio (invariantes), convenciones, comandos, despliegue y env vars.
Sin esto, el agente solo conoce lo genérico — es el gap #1 que se ve en proyectos sin `CLAUDE.md`.

## Modelo de memoria (independiente por proyecto)

- **Instrucciones**: `./CLAUDE.md` en la raíz (lo único que Claude Code carga automáticamente),
  importa la baseline con `@.claude/CLAUDE.base.md`.
- **Memoria runtime**: `.claude/memory/` por proyecto (autogitignoreada). Nunca compartida.

## Enjambre híbrido

- **Con claude-flow** (`npx claude-flow init`): runtime real de coordinación, memoria semántica, aprendizaje.
- **Sin claude-flow**: coordinación nativa con el `Task`/`Agent` tool y memoria local. Misma skill `swarm-orchestration`.

**Orden de capas (importante):** claude-flow es dueño del runtime, así que el instalador lo ejecuta
**primero** y luego aplica nuestra capa **encima** con *skip-existing*. En modo flow:
- Se **respetan** `settings.json`, `helpers/*` y `.mcp.json` de claude-flow (no se pisan).
- Se **omiten** nuestros 5 agentes core (los cubre `agents/core/*` de claude-flow) para no duplicar nombres.
- Se **añaden** sin chocar: `CLAUDE.base.md`, skills de workflow (`tdd`/`diagnose`/`grill-me`/`handoff`), comando `/swarm`,
  y nuestro bloque gestionado se **anexa** al `CLAUDE.md` de claude-flow.

Sin claude-flow, nuestra capa aporta el runtime completo (settings + helpers + agentes core + skills).

## Componentes externos (curados, ver `components.json`)

**Integrados por stack** (vía `claude-code-templates`):
- shared: `code-reviewer`, skills `clean-code`, `senior-security`; marketplace oficial de plugins.
- backend: `database-architect`, `test-engineer`, `architect-review`; skill `docker-expert`.
- frontend/mobile: `frontend-developer`, `ui-ux-designer`; skills `frontend-design`, `ui-design-system`.
- frontend/react + mobile/react-native: dep npm de animación + `react-doctor` (auditoría on-demand).

**Descartados** (con motivo en `components.json`):
- `claude-mem` — duplica nuestra memoria y registra hooks propios.
- `mcp-expert` — atado al repo del CLI de davila7.
- hooks de claude-code-templates (`lint-on-save`, `smart-formatting`, `security-scanner`, `tdd-gate`) —
  su instalador **pisa** nuestros arrays de hooks; su intención (format+lint+secret-scan) ya está en `hook-handler.cjs`.
- `react-best-practices` (cct) — duplica la skill `vercel:react-best-practices` del harness.

## Mantenimiento

Repo **público (MIT)** distribuido por `npx github:` → la rama **`master` debe estar siempre verde**.

- **Validar** antes de commitear: `npm run validate` (frontmatter, JSON, sintaxis; zero-dep).
- **CI** (`.github/workflows/ci.yml`): valida + smoke-test del instalador en los 8 stacks (dry-run) en cada PR.
- **Cómo añadir** agentes, skills, stacks o externos: ver [CONTRIBUTING.md](CONTRIBUTING.md).
- **Versionado**: SemVer en `package.json` + `CHANGELOG.md`. Fija versiones por tag (`#v1.2.0`).
- **Actualizar un proyecto** ya instalado: por defecto el instalador es **aditivo** (añade lo nuevo,
  no pisa lo existente). Para **traer la última versión de agentes/skills/helpers**, ejecútalo con
  **`--update`** (alias `--force`): sobrescribe la capa base haciendo backup antes, y **conserva tu
  memoria (`.claude/memory/`) y tu `CLAUDE.project.md`** (y respeta el `settings.json` de claude-flow
  si está). El bloque gestionado de `CLAUDE.md` es idempotente en cualquier caso.
  ```bash
  npx github:lacasoft/dev-starter-kit --update --yes
  ```
