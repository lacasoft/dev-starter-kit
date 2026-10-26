# Dev Starter Kit — base coherente de Claude para todos los proyectos

Configuración `.claude` unificada para backend, frontend, mobile y blockchain. El objetivo es
**coherencia**: una capa base común a todos los proyectos + particularidades por stack, con
**orquestación multiagente nativa** de Claude Code (sin runtimes de terceros).

## Estructura

```
.
├── install.js                  # instalador: detecta stack, aplica capa base, actualiza, resume
├── components.json             # manifiesto curado de componentes externos (revisados 1 a 1)
├── shared/.claude/             # CAPA BASE (común a todos los proyectos)
│   ├── CLAUDE.base.md          # baseline universal (comportamiento, agentes, memoria, seguridad, calidad)
│   ├── settings.json           # hooks + permisos + statusLine
│   ├── agents/                 # 14 agentes (5 core + 9 especialistas) — ver "Agentes incluidos"
│   ├── skills/                 # 18 skills (flujo + contexto + ingeniería + seguridad) — ver "Skills incluidas"
│   ├── commands/               # /swarm, /kit:status
│   ├── helpers/                # hook-handler, statusline
│   └── templates/              # PROJECT.template.md (definición del proyecto)
├── stacks/                     # OVERLAYS: 13 stacks seleccionables + un `_common` por categoría
│   ├── backend/{_common,nestjs,express,fastapi,django,php,spring,dotnet}
│   ├── frontend/{_common,angular,react,nextjs}
│   ├── mobile/{_common,react-native,flutter}
│   └── blockchain/solidity
├── scripts/                    # validate.cjs (integridad del kit) · stacks.cjs (fuente única)
└── test/                       # tests del hook-handler y de --update (node:test, zero-dep)
```

## Uso

Dentro de **cualquier proyecto** (nuevo o heredado), sin clonar nada:

```bash
npx -y github:lacasoft/dev-starter-kit              # interactivo
npx -y github:lacasoft/dev-starter-kit --yes --all  # desatendido (todo)
npx -y github:lacasoft/dev-starter-kit#v3.0.2       # fijar una versión (recomendado)
```

Toma siempre la última versión de `master` (o el tag indicado). Repo **público (MIT)**.

Alternativa (clone local):

```bash
node /ruta/al/kit/install.js
```

Flags: `--stack backend/nestjs` (fuerza stack; en monorepo, uno por carpeta: `--stack backend/nestjs:apps/api,frontend/nextjs:apps/web`) · `--yes` (no interactivo, conservador) ·
`--all` (acepta TODO: externos + deps; combínalo con `--yes` para desatendido total) ·
`--no-external` · `--update`/`--force` (trae la última capa base sin pisar lo que hayas editado) · `--dry-run` (simula) · `--help`.
`--no-flow` se sigue aceptando para no romper scripts, pero ya no hace nada.

El instalador:
1. **Detecta el stack** (pubspec→flutter, react-native, next, angular, nest, foundry, `.csproj`/`.sln`→dotnet, Spring, django, composer→php, fastapi, react, express).
   - **La raíz manda, pero no es obligatoria.** Si en la raíz no hay nada reconocible, se buscan subdirectorios (hasta 3 niveles, saltando `node_modules`, `bin`, `obj`, `target`, `dist`…). Es lo normal en .NET (`Proyecto/Proyecto.csproj`, `src/App/App.csproj`) y frecuente en Java y en repos con `backend/`+`web/`. El instalador dice **por dónde** lo detectó y sigue instalando en el directorio donde lo corriste, para que el `CLAUDE.md` cubra todo el repo.
   - **Monorepo**: si en subcarpetas aparecen **stacks distintos** (p. ej. `apps/api` NestJS y `apps/web` Next.js, también bajo `packages/`), los lista y aplica cada uno solo a su carpeta (ver [Monorepos](#monorepos)). La misma tecnología en varias carpetas (`src/Api` + `tests/Api.Tests`) sigue siendo un solo stack.
   - **Java/Kotlin**: se reconoce Spring por sus señales (`spring-boot`, `org.springframework`, el plugin de Gradle o `io.spring.dependency-management`) en `pom.xml`, `build.gradle(.kts)` y `settings.gradle(.kts)`. Un proyecto Java **sin** Spring no se fuerza al overlay de Spring: el instalador lo dice y te deja elegir.
   - Si la detección falla, imprime **qué vio** en el directorio en vez de rendirse sin explicación.
   - En un proyecto **fullstack con un solo `package.json`** (p. ej. express + react juntos) gana el **frontend**; si el repo es principalmente API, fuerza con `--stack backend/express`.
2. Hace **backup** de tu `.claude/` si existe.
3. Aplica la **capa base** (`shared/.claude` → `.claude/`): agentes, skills, helpers, settings, comandos.
4. Scaffolda **`CLAUDE.project.md`**, compone **`./CLAUDE.md`** = `@CLAUDE.project.md` + `@.claude/CLAUDE.base.md` (bloque gestionado idempotente) y escribe los overlays del stack como **reglas** en `.claude/rules/kit/` (`<categoría>.md` + `<categoría>-<stack>.md`).
5. Actualiza **`.gitignore`** (memoria/runtime/backups/secretos), idempotente. Los ejemplos de env (`.env.example`, `.env.sample`, `.env.template`) quedan **versionados**: van negados después de `.env.*`. En un proyecto Node añade también `node_modules/` (`npm init` no crea `.gitignore` y el kit instala devDeps).
6. **Avisa de restos de Ruflo** (claude-flow) si los encuentra: servidores en `.mcp.json`, `.claude-flow/`, `.swarm/`, archivos en `.claude/` o instrucciones en `CLAUDE.md`. Solo los enumera con el comando para quitarlos; no borra nada que no instaló el kit.
7. (opcional) Instala **agentes/skills externos** curados vía `claude-code-templates` y deps npm por stack.
   - Los **git hooks** (husky + lint-staged + commitlint) se omiten si el directorio no es un repositorio git: `npx husky init` fallaría y dejaría las devDeps instaladas para nada.
   - Se instalan con **versión exacta** y solo versiones con 7+ días publicadas (`npm install -E --before=…`), la misma regla §6.1 que el kit exige al agente.
   - El `pre-commit` corre lint-staged con lo que el proyecto **ya tiene** (prettier, eslint, `tsc --noEmit` si hay `tsconfig.json`) y se escribe `.lintstagedrc.mjs`. Si no hay nada que revisar, no se instala lint-staged ni se deja `pre-commit` (sin configuración bloquearía todos los commits); el mensaje se valida igual con commitlint. Una configuración de lint-staged existente se respeta.
8. Indica los **plugins de Claude Code** a añadir (shared + por-stack), incluido el de **code intelligence (LSP)** del stack: go-to-definition, referencias y errores de tipos en vivo para el agente. El binario del language server lo instalas tú; el comando exacto sale en pantalla.
9. Imprime un **resumen del proyecto**: stack y lenguaje, framework, paquetes, motores de datos, volumen de código, tests, calidad, entrega (CI/contenedores), git y entorno. Lo marcado con ⚠️ es un hueco frente a la baseline del kit.

### Sin TTY (CI, agentes, tuberías)

`readline` en modo no-TTY emite todas las líneas de golpe, así que el instalador **drena `stdin` a una cola** y cada pregunta consume una línea; al agotarse usa los defaults:

```bash
printf 'y\nn\ny\n' | node install.js
```

Con `--yes` el stack debe ser detectable o venir en `--stack`; si no, sale con **código 1** en vez de instalar a medias.

## Monorepos

Un monorepo con varios stacks recibe las reglas de **cada stack solo en su carpeta**, gracias a las
reglas con `paths:` de Claude Code: al trabajar en `apps/api/` se cargan las de NestJS; en
`apps/web/`, las de Next.js; en la raíz, solo la baseline y `CLAUDE.project.md`.

```bash
npx -y github:lacasoft/dev-starter-kit                    # detecta los stacks por carpeta y pide confirmar
npx -y github:lacasoft/dev-starter-kit --yes --stack backend/nestjs:apps/api,frontend/nextjs:apps/web
```

Así queda `.claude/rules/kit/backend-nestjs.md`:

```markdown
---
paths:
  - "apps/api/**"
---
<!-- dev-starter-kit · overlay backend/nestjs. … -->
# Stack: NestJS — playbook senior …
```

- El mismo stack en varias carpetas comparte una regla con varias rutas; el común de la categoría
  (`backend.md`, `frontend.md`) se acota a la unión de sus carpetas.
- En un proyecto de un solo stack las reglas van **sin** `paths:` y se cargan siempre, como antes.
- Las reglas están en el manifiesto: si editas una, `--update` la respeta; si cambias de stack, la
  del stack anterior se retira si nadie la tocó.
- Las dependencias npm sugeridas por stack no se instalan en la raíz de un monorepo: el instalador
  dice en qué paquete van.
- **Desde 2.x**: el overlay iba dentro del bloque gestionado de `CLAUDE.md` y se regeneraba en cada
  ejecución (perdías lo que editaras ahí). `--update` lo saca del bloque y lo pasa a reglas; lo que
  tengas fuera del bloque no se toca.

## Agentes incluidos (capa base, profundidad experta)

**Core**: `planner` · `researcher` · `coder` · `tester` · `reviewer`
**Especialistas**: `backend-developer` · `security-engineer` · `api-security-audit` · `penetration-tester` (solo autorizado) · `monitoring-specialist` · `api-architect` · `ui-designer` · `seo-specialist` · `ux-researcher`

Además, el kit instala por stack agentes/skills externos curados (`frontend-developer`, `database-architect`, `test-engineer`, etc.) vía claude-code-templates.

## Skills incluidas (capa base)

**Flujo de trabajo**: `tdd` · `diagnose` · `grill-me` · `handoff` · `swarm-orchestration` · `verification` · `code-review-response` · `git-worktrees`
**Contexto y memoria**: `project-context` (rellena `CLAUDE.project.md` a partir del repo real) · `adr` (registro de decisiones en `docs/adr/`)
**Ingeniería/entrega**: `ci-cd` · `performance-profiling` · `migration` · `monorepo` · `release` · `ship-gate` · `iac`
**Seguridad**: `owasp-review` (revisión contra OWASP Top 10:2025, ASVS 5.0 y CWE; LLM y agentes 2026)

Las de ingeniería se destilaron (en español, a nuestra profundidad) del catálogo MIT
[alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills) (330+ skills).
Para más, su marketplace es una fuente opcional: `/plugin marketplace add alirezarezvani/claude-skills`
(cherry-pick por dominio; no instalar en bloque — ver `components.json`).

## Definición del proyecto (contexto real)

La capa base son reglas **genéricas**. Para que el agente entienda *este* producto en concreto,
el instalador scaffolda **`CLAUDE.project.md`** (desde `shared/templates/PROJECT.template.md`) y el
`CLAUDE.md` raíz lo importa con `@CLAUDE.project.md`. Debe tener: visión, dominio, stack real
(p.ej. Biome vs ESLint), estructura del repo (**en monorepo, lista los packages y su stack**),
arquitectura, reglas de negocio (invariantes), nivel ASVS, atributos de calidad, convenciones,
comandos, despliegue y env vars. Sin esto, el agente solo conoce lo genérico — es el gap #1 que se
ve en proyectos sin `CLAUDE.md`.

No hace falta rellenarlo a mano: en Claude Code, **`/project-context`** lee el repo, **corre** los
comandos de build/test/lint antes de documentarlos, rellena lo derivable y te pregunta en una sola
tanda lo que no se puede deducir. Mientras siga siendo la plantilla, cada sesión arranca con un
aviso que lo sugiere.

### Desde un diseño (system-design-kit)

Si diseñaste el sistema con [system-design-kit](https://github.com/lacasoft/system-design-kit),
no reescribas nada: en el proyecto de código, pasa la ruta del diseño.

```bash
claude --add-dir ../acortador-urls      # para que pueda leer la carpeta del diseño
> /project-context ../acortador-urls/design.md
```

| Del diseño | Al proyecto |
| --- | --- |
| Requisitos y fuera de alcance | *Visión del producto* (con "Fuera de alcance (v1)") |
| Requisitos no funcionales y escala | *Atributos de calidad* con sus umbrales |
| API y modelo de datos | *Modelo / dominio* y contratos en *Arquitectura* |
| Arquitectura inicial y escenarios de falla | *Arquitectura* (con "Fallas previstas") y tests de regresión en *Testing* |
| Decisiones clave y tradeoffs | **Un ADR por decisión** en `docs/adr/`, con la plantilla de la skill `adr` |
| Supuestos sin confirmar | *Pendiente de confirmar* |

Lo que el repo sí sabe (stack real, comandos, estructura) sigue saliendo del repo. El archivo
anota de qué diseño salió y su fecha, así que si el diseño cambia, volver a correrlo actualiza
solo lo que vino de ahí; un ADR aceptado no se edita, se reemplaza por otro.

## Memoria y contexto (nativos de Claude Code)

| Qué | Dónde | Quién lo escribe | Versionado |
| --- | --- | --- | --- |
| Instrucciones | `./CLAUDE.md` (importa `CLAUDE.project.md` y la baseline) | el equipo / `/project-context` | sí |
| Decisiones | `docs/adr/` | el equipo / skill `adr` | sí |
| Memoria de equipo | `.claude/agent-memory/{researcher,reviewer,security-engineer}/` | esos agentes (`memory: project`) | **sí**, se revisa en PR |
| Memoria personal | `~/.claude/projects/<repo>/memory/` (auto memory) y `CLAUDE.local.md` | Claude / tú | no |

- **Memoria de equipo**: `researcher` recuerda el mapa del repo y sus trampas, `reviewer` los
  problemas que se repiten y las excepciones aceptadas, `security-engineer` el threat model y los
  riesgos aceptados. Claude Code carga su `MEMORY.md` al invocarlos. Como se versiona, la conoce todo
  el equipo y un cambio malicioso se ve en el PR (envenenamiento de memoria, ASI06).
- `researcher` y `reviewer` son de solo lectura: Claude Code les habilita `Write`/`Edit` para cuidar
  su memoria, y un hook del propio agente (`memory-only`) les impide escribir en cualquier otro sitio.
- **Memoria personal**: la automática de Claude Code (activa por defecto, una por repo, compartida
  entre worktrees) guarda tus preferencias y correcciones. No hay nada que instalar.
- **Nunca a memoria**: secretos, PII, valores de env, ni texto externo guardado como regla.

Hasta la 2.x el kit tenía una memoria propia (`.claude/memory/memory.jsonl` + hooks de
`SessionStart`/`Stop`). Se retiró porque en la práctica no guardaba nada útil (solo marcadores de
sesión, que además se filtraban al leer) y la memoria nativa la sustituye con ventaja. `--update`
borra sus helpers si siguen intactos; `.claude/memory/` no se toca y sigue en `.gitignore`.

## Cadena de suministro (baseline §6.1)

Antes de instalar cualquier cosa (dependencia, skill, agente, plugin, MCP, action de CI) o de correr
un comando que toque el sistema, hay que validar que sea seguro. No es solo una regla escrita: el hook
`pre-bash` de `hook-handler.cjs` la hace exigible en tres niveles.

| Nivel | Qué cubre | Ejemplos |
| --- | --- | --- |
| `deny` | Destructivo, irreversible o fuera del proyecto | `curl … \| sh` · `sudo` · `npm i -g` · `npm publish` · escribir en `/etc`, `/usr` · `dd of=/dev/…` · `chmod 777` · leer `~/.ssh` · `--no-verify` |
| `ask` | Mete código de terceros nuevo → lo confirma la persona | `npm install <pkg>` · `pip install <pkg>` · `npx`/`pnpm dlx`/`yarn dlx`/`bunx`/`uvx`/`pipx run` · `claude mcp add` · `claude-code-templates --agent/--skill` |
| libre | No añade superficie de ataque | `npm ci` · `npm install` (del lockfile) · `pip install -r requirements.txt` · `npx --no-install` |

El motivo que recibe el modelo incluye la checklist a verificar: nombre exacto (typosquatting),
publisher oficial, **versión pineada** (nunca `@latest`/`@alpha`), **publicada hace 7+ días** (salvo fix de
seguridad), scripts `pre/postinstall`, y si algo del repo ya lo cubre. Si un comando se bloquea, la respuesta correcta es replantearlo, no esquivar el hook.
Como defensa en profundidad, `settings.json` deniega además `sudo`, `publish`, `chmod 777` y la lectura
de `~/.ssh` y `~/.aws` por permisos, para el caso de que los hooks estén desactivados.

## Estándares de seguridad

| Estándar | Edición | Dónde se aplica |
| --- | --- | --- |
| OWASP Top 10 | **2025** (incluye A03 Supply Chain y A10 Exceptional Conditions; SSRF pasa a A01) | baseline §6, `security-engineer`, `reviewer`, `owasp-review` |
| OWASP ASVS | **5.0** — nivel por proyecto (L1 mínimo, L2 con datos sensibles) en `CLAUDE.project.md` | `owasp-review`, `ship-gate` |
| CWE Top 25 | **2025** — cada hallazgo lleva su CWE | `security-engineer`, `owasp-review` |
| OWASP API Security Top 10 | **2023** (vigente) | `api-security-audit`, `api-architect` |
| OWASP Top 10 for LLM Applications | **2026** | `owasp-review`, `ship-gate`, si el producto usa LLMs |
| OWASP Top 10 for Agentic Applications | **2026** | `owasp-review`, baseline §6 (contenido externo = datos) |
| OWASP MASVS | **v2** | overlay `mobile/_common`, `penetration-tester` |

Las listas completas, qué buscar en cada categoría y las fuentes están en
`shared/.claude/skills/owasp-review/referencia.md`. Cuando un estándar publique edición nueva, se
actualiza ahí y en esta tabla.

## Orquestación multiagente (nativa)

Todo con herramientas de Claude Code: el tool `Agent` para lanzar subagentes en paralelo, los
agentes de `.claude/agents/`, worktrees para aislar a los que escriben (skill `git-worktrees`) y
la memoria de agente para lo que deba sobrevivir a la sesión. La skill `swarm-orchestration` y el
comando `/swarm` dan el método: descomponer con `planner`, lanzar en un solo mensaje, pasar el
contexto exacto a cada subagente y verificar con `reviewer` antes de integrar.

**Ruflo (claude-flow) ya no se integra.** Hasta la 2.x el kit podía ejecutar `claude-flow init`
como "enjambre híbrido". Se retiró porque no es estándar: trae su propio runtime, servidores MCP,
decenas de archivos en `.claude/` y hooks que corren en cada sesión, y la coordinación nativa
cubre lo que usábamos. Si un proyecto lo tenía:

- `--update` retira de `settings.json` todo lo que apunte a Ruflo (permisos, hooks, env) y lo informa.
- El resto (servidores en `.mcp.json`, `.claude-flow/`, `.swarm/`, sus archivos en `.claude/`) se
  **enumera** con el comando para quitarlo, pero no se borra: no lo instaló el kit directamente.

## Componentes externos (curados, ver `components.json`)

**Integrados por stack** (vía `claude-code-templates`, solo los marcados `integrar`):
- shared: `code-reviewer`, skills `clean-code`, `senior-security`; marketplace oficial de plugins.
- code intelligence (plugins oficiales LSP, se indican por stack): `typescript-lsp` (Nest, Express,
  Angular, React, Next, React Native), `pyright-lsp` (FastAPI, Django), `jdtls-lsp`
  (Spring), `csharp-lsp` (.NET). Sin plugin oficial libre para PHP (`php-lsp` usa Intelephense,
  de licencia propietaria), Dart ni Solidity.
- backend: `database-architect`, `test-engineer`; skill `docker-expert`.
- frontend/mobile: `frontend-developer`, `ui-ux-designer`; skills `frontend-design`, `ui-design-system`.
- frontend/react + mobile/react-native: dep npm de animación (`motion` / `react-native-reanimated`).

**Opcionales** (en `components.json` pero *no* se instalan solos; añádelos a mano si los quieres):
`architect-review` (backend) y `senior-frontend` (frontend).

**Regla para todo externo** (baseline §6.1.7): nada de pago, que exija API key o cuenta de un tercero,
o con licencia propietaria o comercial.

**Descartados** (extracto; los 17 con su motivo están en `components.json` → `discarded`):
- `ruvnet/claude-flow` (Ruflo) — retirado en la 3.x; ver "Orquestación multiagente".
- `claude-mem` — duplica la memoria nativa y registra hooks propios.
- `php-lsp` (Intelephense) y `react-doctor` — licencia propietaria y MIT modificada con restricciones.
- `security-guidance` y `claude-security` — el primero hace llamadas pagadas a Opus en cada turno y
  commit; el segundo tiene licencia propietaria. Su lugar lo ocupa la skill `owasp-review`.
- `semgrep` (Guardian) — envía cada archivo que escribe el agente a la nube de Semgrep, en todos los
  proyectos, y se autoactualiza con binarios opacos. Alternativa: `semgrep` CLI local o en CI.
- `serena` — arranca con `uvx` desde el último commit de GitHub, sin versión fijada; los plugins LSP
  oficiales cubren lo que aporta.
- `mcp-expert` — atado al repo del CLI de davila7.
- hooks de claude-code-templates (`lint-on-save`, `smart-formatting`, `security-scanner`, `tdd-gate`) —
  su instalador **pisa** nuestros arrays de hooks; su intención (format+lint+secret-scan) ya está en `hook-handler.cjs`.
- `react-best-practices` (cct) — duplica la skill `vercel:react-best-practices` del harness.

## Actualizar un proyecto ya instalado

```bash
npx -y github:lacasoft/dev-starter-kit --update --yes
```

No hace falta repetir `--stack`: el instalador **recuerda los stacks** de la instalación anterior (y sus carpetas, en un monorepo) y solo pide confirmar. Para cambiarlo, pasa `--stack` de nuevo.

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
| El kit ya no lo distribuye y sigue intacto | Se borra 🗑️ (p. ej. los helpers de la memoria propia de la 2.x) |
| El kit ya no lo distribuye y lo editaste | Se conserva y se avisa |
| `settings.json` | Se **fusiona**: tus permisos, hooks, `env` y demás claves se mantienen; se añaden los del kit |
| Reglas del stack (`.claude/rules/kit/`) | Igual que cualquier archivo del kit; si cambias de stack, la vieja se retira si sigue intacta |
| `.claude/agent-memory/`, `.claude/memory/`, `.claude/rules/` fuera de `kit/`, `CLAUDE.project.md`, `docs/adr/` | Nunca se tocan |

El `settings.json` merece detalle porque es el que la gente personaliza: la unión de `permissions`
es sin duplicados, en `hooks` el kit solo reemplaza **sus** entradas (las que apuntan a sus helpers)
y las tuyas siguen ahí, en `env` ganan tus valores, y si tu `statusLine` apunta a otro script se
respeta. La única excepción es lo que apunta a Ruflo (claude-flow): se retira y se informa.

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
npx -y github:lacasoft/dev-starter-kit#v3.0.2 --update --yes    # por tag
npx -y github:lacasoft/dev-starter-kit#<commit> --update --yes  # por commit (el SHA del tag)
```

Si aun así sospechas que te sirvió una copia vieja, compara el número de versión del banner del
instalador con el del `CHANGELOG` y limpia con `npm cache clean --force`.

## Mantenimiento

Repo **público (MIT)** distribuido por `npx github:` → la rama **`master` debe estar siempre verde**.

- **Validar** antes de commitear: `npm run validate` (frontmatter, JSON, sintaxis, es-MX; zero-dep).
  Comprueba también que **este README no mienta**: los conteos de agentes, skills y stacks, la lista
  de helpers del árbol, los stacks por categoría, el número de descartados y que los ejemplos
  pineados (`#vX.Y.Z`) apunten a la versión de `package.json`. Si reescribes una de esas frases,
  actualiza el patrón en `scripts/validate.cjs` — la comprobación no debe perderse en silencio.
- **Tests**: `npm test` (`node:test`, sin dependencias) — guards del hook-handler y `--update`.
- **CI** (`.github/workflows/ci.yml`): valida + tests + smoke-test del instalador en los **13 stacks**
  (dry-run) y en un monorepo multi-stack, en cada PR. La lista sale de `scripts/stacks.cjs`, que la deriva de `install.js`.
- **Cómo añadir** agentes, skills, stacks o externos: ver [CONTRIBUTING.md](CONTRIBUTING.md).
- **Versionado**: SemVer en `package.json` + `CHANGELOG.md`, con tag anotado por versión
  (`v3.0.2`). Instala siempre pineando (`#v3.0.2`): es reproducible y evita la cache de npx.
