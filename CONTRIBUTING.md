# Mantener el Dev Starter Kit

Guía para evolucionar el kit sin romper la coherencia. **Regla de oro:** tras cualquier cambio, corre `npm run validate` (lo exige la CI).

## Estructura

```
install.js            # instalador (bin del paquete; lo ejecuta `npx github:lacasoft/...`)
components.json       # manifiesto de externos curados (claude-code-templates, plugins, npm)
scripts/validate.cjs  # validación zero-dep (CI + local)
shared/.claude/       # capa base común a TODOS los proyectos
  ├── CLAUDE.base.md  # baseline universal
  ├── settings.json   # hooks + permisos + statusLine + claudeFlow
  ├── agents/         # agentes expertos (.md con frontmatter)
  ├── skills/<name>/SKILL.md
  ├── helpers/        # hook-handler, memory, router, etc. (zero-dep)
  ├── commands/
  └── templates/PROJECT.template.md
stacks/<categoria>/{_common,<stack>}/.claude/CLAUDE.md   # overlays por stack
```

## Añadir un AGENTE

1. Crea `shared/.claude/agents/<nombre>.md` con frontmatter:
   ```yaml
   ---
   name: <nombre-kebab>            # único; NO uses coder/planner/reviewer/tester/researcher (los cubre claude-flow)
   description: "<cuándo usarlo + 2 bloques <example>>"
   tools: Read, Write, Edit, Bash, Glob, Grep
   model: sonnet
   ---
   ```
2. Cuerpo en **español**, profundidad senior: persona → dominio → metodología → reglas → salida → integración (referencia solo a agentes que existen).
3. NO reintroduzcas `context-manager` ni protocolos JSON de coordinación.
4. Si el nombre coincide con uno de los 5 core, el instalador lo omite en modo claude-flow (a propósito). Para que sobreviva, usa otro nombre.
5. `npm run validate`.

## Añadir una SKILL

1. `shared/.claude/skills/<nombre>/SKILL.md` con frontmatter `name` + `description` (1 frase de cuándo usarla).
2. Cuerpo: persona experta + metodología + técnicas + reglas. Si la destilas de un repo externo, **acredita la fuente y su licencia**.
3. `npm run validate`.

## Añadir un STACK

1. Crea `stacks/<categoria>/<stack>/.claude/CLAUDE.md` (overlay específico). Si la categoría es nueva, crea también `stacks/<categoria>/_common/.claude/CLAUDE.md`.
2. Registra el id en `install.js`:
   - Añádelo al objeto `STACKS`.
   - Añade su regla en `detectStack()` (archivo/dep delator).
3. Si aplica, añade en `components.json` los agentes/skills/npm de esa categoría.
4. `npm run validate` y prueba: `node install.js --stack <categoria>/<stack> --dry-run`.

## Añadir un EXTERNO (claude-code-templates / plugin / npm)

Edita `components.json`:
- `shared.agents/skills` → para todos los stacks.
- `stacks.<categoria>.agents/skills` con `rec: "integrar"|"opcional"`.
- `byStackId."<cat>/<stack>".npm/tools` → deps o herramientas concretas.
- Plugins: `shared.pluginMarketplaces`/`pluginsOptional` o `stacks.<cat>.pluginsOptional`.
- Si lo **descartas**, anótalo en `discarded` con el motivo (para no re-evaluarlo).

**Antes de integrar un externo: revísalo** (qué hace, conflictos con nuestros hooks/memoria, licencia). Los hooks de claude-code-templates pisan nuestros arrays — su intención se replica en `hook-handler.cjs`, no se instalan.

## Versionado y release

- SemVer en `package.json` + entrada en `CHANGELOG.md`.
- Como se distribuye por `npx github:`, los proyectos toman la rama por defecto: **`master` siempre debe estar verde** (CI en cada PR). Usa ramas `feat/…`, `fix/…` y PRs.
- Para fijar versiones en un proyecto concreto: `npx github:lacasoft/dev-starter-kit#v1.2.0`.

## Probar localmente

```bash
npm run validate                                  # integridad
node install.js --stack backend/nestjs --dry-run  # simula sin escribir
# en un proyecto de prueba real:
cd /tmp/proyecto && node /ruta/al/kit/install.js --yes --no-flow --no-external
```
