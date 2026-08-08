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
`--no-flow` · `--no-external` · `--update`/`--force` (trae la última capa base sin pisar lo que hayas editado) · `--dry-run` (simula) · `--help`.

El instalador:
1. **Detecta el stack** (pubspec→flutter, react-native, next, angular, nest, foundry, .csproj→dotnet, spring, django, composer→php, fastapi, react, express).
   - En un proyecto **fullstack con un solo `package.json`** (p. ej. express + react juntos) gana el **frontend**; si el repo es principalmente API, fuerza con `--stack backend/express`.
2. Hace **backup** de tu `.claude/` si existe.
3. Aplica la **capa base** (`shared/.claude` → `.claude/`): agentes, skills, helpers, settings, comandos.
4. Scaffolda **`CLAUDE.project.md`** y compone **`./CLAUDE.md`** = `@CLAUDE.project.md` + `@.claude/CLAUDE.base.md` + común + stack (bloque gestionado idempotente).
5. Actualiza **`.gitignore`** (memoria/runtime/backups/secretos), idempotente. Los ejemplos de env (`.env.example`, `.env.sample`, `.env.template`) quedan **versionados**: van negados después de `.env.*`.
6. (opcional) Ejecuta **`claude-flow init`** para el enjambre real (primero; la capa va encima sin pisarlo).
7. (opcional) Instala **agentes/skills externos** curados vía `claude-code-templates` y deps npm por stack.
   - Los **git hooks** (husky + lint-staged + commitlint) se omiten si el directorio no es un repositorio git: `npx husky init` fallaría y dejaría las devDeps instaladas para nada.
8. Indica los **plugins de Claude Code** a añadir (shared + por-stack).
9. Imprime un **resumen del proyecto**: stack y lenguaje, framework, paquetes, motores de datos, volumen de código, tests, calidad, entrega (CI/contenedores), git y entorno. Lo marcado con ⚠️ es un hueco frente a la baseline del kit.

### Sin TTY (CI, agentes, tuberías)

`readline` en modo no-TTY emite todas las líneas de golpe, así que el instalador **drena `stdin` a una cola** y cada pregunta consume una línea; al agotarse usa los defaults:

```bash
printf 'y\nn\ny\n' | node install.js
```

Con `--yes` el stack debe ser detectable o venir en `--stack`; si no, sale con **código 1** en vez de instalar a medias.

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

## Cadena de suministro (baseline §6.1)

Antes de instalar cualquier cosa (dependencia, skill, agente, plugin, MCP, action de CI) o de correr
un comando que toque el sistema, hay que validar que sea seguro. No es solo una regla escrita: el hook
`pre-bash` de `hook-handler.cjs` la hace exigible en tres niveles.

| Nivel | Qué cubre | Ejemplos |
| --- | --- | --- |
| `deny` | Destructivo, irreversible o fuera del proyecto | `curl … \| sh` · `sudo` · `npm i -g` · `npm publish` · escribir en `/etc`, `/usr` · `dd of=/dev/…` · `chmod 777` · leer `~/.ssh` · `--no-verify` |
| `ask` | Mete código de terceros nuevo → lo confirma la persona | `npm install <pkg>` · `pip install <pkg>` · `npx <pkg>` · `claude-code-templates --agent/--skill` |
| libre | No añade superficie de ataque | `npm ci` · `npm install` (del lockfile) · `pip install -r requirements.txt` · `npx --no-install` |

El motivo que recibe el modelo incluye la checklist a verificar: nombre exacto (typosquatting),
publisher oficial, **versión pineada** (nunca `@latest`/`@alpha`), scripts `pre/postinstall`, y si algo
del repo ya lo cubre. Si un comando se bloquea, la respuesta correcta es replantearlo, no esquivar el hook.
Como defensa en profundidad, `settings.json` deniega además `sudo`, `publish`, `chmod 777` y la lectura
de `~/.ssh` y `~/.aws` por permisos, para el caso de que los hooks estén desactivados.

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
## Actualizar un proyecto ya instalado

```bash
npx -y github:lacasoft/dev-starter-kit --update --yes
```

Por defecto el instalador es **aditivo** (añade lo nuevo, no pisa lo existente). Con **`--update`**
(alias `--force`) trae además la última versión de agentes, skills y helpers — **sin que pierdas
nada tuyo**, que es justo lo que un starter kit debe evitar.

Cómo lo consigue: al instalar se escribe `.claude/.kit-manifest.json` con el hash de cada archivo
*tal como lo dejó el kit*. En la siguiente actualización eso permite distinguir lo intacto de lo
que tú editaste:

| Situación | Qué pasa |
| --- | --- |
| El archivo sigue igual que como lo instaló el kit | Se actualiza ⬆️ |
| Lo editaste tú y el kit **no** lo cambió | Se respeta, sin ruido |
| Lo editaste tú **y** el kit lo cambió | Se conserva el tuyo; la versión nueva queda como `*.kit-new` y se te imprime el `diff` a ejecutar |
| `settings.json` | Se **fusiona**: tus permisos, hooks, `env` y demás claves se mantienen; se añaden los del kit |
| `.claude/memory/`, `CLAUDE.project.md` | Nunca se tocan |

El `settings.json` merece detalle porque es el que la gente personaliza: la unión de `permissions`
es sin duplicados, en `hooks` el kit solo reemplaza **sus** entradas (las que apuntan a sus helpers)
y las tuyas siguen ahí, en `env` ganan tus valores, y si tu `statusLine` apunta a otro script se
respeta. Si claude-flow es dueño del runtime, su `settings.json` no se toca ni se fusiona.

Se sigue haciendo backup en `.claude.backup.<timestamp>` antes de cualquier cambio, pero ya no
deberías necesitarlo. El bloque gestionado de `CLAUDE.md` es idempotente en cualquier caso.

**Proyectos instalados con una versión anterior** no tienen manifiesto, así que la primera
actualización es conservadora: preserva lo que hay y deja las versiones nuevas como `*.kit-new`.
Si no habías editado nada, el propio instalador te imprime el comando para aceptarlas de golpe:

```bash
find .claude -name '*.kit-new' -exec sh -c 'mv "$1" "${1%.kit-new}"' _ {} \;
```

A partir de ahí ya hay manifiesto y las siguientes actualizaciones son limpias.

### Cache de npx

`npx github:usuario/repo` **cachea** el paquete: si el kit avanza y reejecutas poco después, puedes
recibir la copia vieja. La solución buena es la misma que exige la baseline §6.1 — **pinear la
versión** — y de paso hace la instalación reproducible:

```bash
npx -y github:lacasoft/dev-starter-kit#v2.1.0 --update --yes   # por tag
npx -y github:lacasoft/dev-starter-kit#52c5332 --update --yes  # por commit
```

Si aun así sospechas que te sirvió una copia vieja, compara el número de versión del banner del
instalador con el del `CHANGELOG` y limpia con `npm cache clean --force`.
