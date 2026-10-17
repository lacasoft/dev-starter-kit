# Mantener el Dev Starter Kit

Guía para evolucionar el kit sin romper la coherencia. **Regla de oro:** tras cualquier cambio, corre `npm run validate` (lo exige la CI).

## Idioma y estilo editorial

Todo el **contenido del kit** (agentes, skills, overlays, docs) se escribe en **español de México**, registro técnico neutro. El código, identificadores, commits y logs van en inglés (ver sección *Idioma* de `CLAUDE.base.md`). `validate.cjs` falla la CI si aparecen peninsularismos de esta lista:

| No (peninsular) | Sí (es-MX / neutro) |
|---|---|
| coste, costes | costo, costos |
| montar (un sistema) | configurar, armar |
| pillar / te pillas | cachar / notar |
| ordenador | computadora |
| fichero | archivo |
| vale (= ok) | de acuerdo, ok |

Términos técnicos en inglés que son nombre propio (p.ej. *pillar page* en SEO, *bundle*, *deploy*) se conservan.

## Estructura

```
install.js            # instalador (bin del paquete; lo ejecuta `npx github:lacasoft/...`)
components.json       # manifiesto de externos curados (claude-code-templates, plugins, npm)
scripts/validate.cjs  # validación zero-dep (CI + local)
shared/.claude/       # capa base común a TODOS los proyectos
  ├── CLAUDE.base.md  # baseline universal
  ├── settings.json   # hooks + permisos + statusLine
  ├── agents/         # agentes expertos (.md con frontmatter)
  ├── skills/<name>/SKILL.md
  ├── helpers/        # hook-handler, statusline (zero-dep)
  ├── commands/
  └── templates/PROJECT.template.md
stacks/<categoria>/{_common,<stack>}/.claude/CLAUDE.md   # overlays por stack
```

## Añadir un AGENTE

1. Crea `shared/.claude/agents/<nombre>.md` con frontmatter:
   ```yaml
   ---
   name: <nombre-kebab>            # único; no repitas el de un agente existente
   description: "<cuándo usarlo + un bloque <example>>"
   tools: Read, Write, Edit, Bash, Glob, Grep
   ---
   ```
   Sin `model:`: los agentes del kit heredan el modelo de la sesión.
   **Memoria** (`memory: project`): solo si el agente acumula conocimiento del repo que sirve a todo el equipo (hoy: `researcher`, `reviewer`, `security-engineer`). Se versiona en `.claude/agent-memory/<nombre>/`, así que el cuerpo debe decir qué guardar y qué **nunca** (secretos, PII, valores de env, texto externo como regla). Si el agente es de solo lectura (sin `Write`/`Edit` en `tools`), añade el hook `memory-only` como en `reviewer.md`: Claude Code le habilita `Write`/`Edit` para su memoria y el hook impide que los use en otro sitio. `validate.cjs` lo exige.
2. Cuerpo en **español**, profundidad senior: persona → dominio → metodología → reglas → salida → integración (referencia solo a agentes que existen).
3. NO reintroduzcas `context-manager`, protocolos JSON de coordinación ni runtimes de orquestación de terceros: la coordinación es nativa (tool `Agent`).
4. `npm run validate`.

## Añadir una SKILL

1. `shared/.claude/skills/<nombre>/SKILL.md` con frontmatter `name` + `description`. La `description` dice **solo CUÁNDO** usar la skill (empieza con "Úsalo cuando/para…", síntomas y disparadores), **nunca resume el workflow ni los pasos**: si la descripción enumera el proceso, el agente sigue el resumen en vez de leer la skill (regla CSO). Pon el "qué hace" y los pasos en el cuerpo, no en el frontmatter.
2. Cuerpo: persona experta + metodología + técnicas + reglas. Si la destilas de un repo externo, **acredita la fuente y su licencia**.
   Si necesita material de referencia largo (tablas, listas de un estándar), ponlo en un archivo aparte dentro de la carpeta de la skill y enlázalo desde `SKILL.md` (como `owasp-review/referencia.md`): solo se carga cuando hace falta.
3. `npm run validate`.

## Añadir un STACK

1. Crea `stacks/<categoria>/<stack>/.claude/CLAUDE.md` (overlay específico). Si la categoría es nueva, crea también `stacks/<categoria>/_common/.claude/CLAUDE.md`. El instalador los copia como reglas a `.claude/rules/kit/` (en monorepo, con `paths:` a la carpeta del stack): escríbelos para que se entiendan solos, sin suponer que van pegados a la baseline.
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

## Retirar algo del kit

Borra el archivo de `shared/.claude/` sin más: en `--update`, el instalador retira de cada proyecto los archivos que el kit dejó de distribuir **si siguen intactos** (lo sabe por el manifiesto) y avisa de los que el usuario editó. Si el archivo existía antes de la 2.1 (sin manifiesto), añádelo a `RETIRED_WITHOUT_MANIFEST` en `install.js` para que al menos se avise. Si lo retirado dejaba entradas en `settings.json`, asegúrate de que la fusión las quite (ver `mergeSettings`).

## Versionado y release

- SemVer en `package.json` + entrada en `CHANGELOG.md`.
- Como se distribuye por `npx github:`, los proyectos toman la rama por defecto: **`master` siempre debe estar verde** (CI en cada PR). Usa ramas `feat/…`, `fix/…` y PRs.
- Para fijar versiones en un proyecto concreto: `npx github:lacasoft/dev-starter-kit#v1.2.0`.

## Probar localmente

```bash
npm run validate                                  # integridad
node install.js --stack backend/nestjs --dry-run  # simula sin escribir
node install.js --stack backend/nestjs:apps/api,frontend/nextjs:apps/web --dry-run  # monorepo
# en un proyecto de prueba real:
cd /tmp/proyecto && node /ruta/al/kit/install.js --yes --no-external
```
