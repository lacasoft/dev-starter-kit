# Changelog

Formato basado en [Keep a Changelog](https://keepachangelog.com/) y [SemVer](https://semver.org/).

## [No publicado]

### Added
- **Estándares de C# en el agente `coder`.** "Estándares por lenguaje" cubría TypeScript, Python, Go, Rust, Solidity, PHP, Java y Dart, pero **no C#**, pese a existir un stack `backend/dotnet` completo y a que la regla de nombres ya lo mencionaba. Se añade su sección (nullable reference types, `record`/`sealed`, `async` sin `.Result`/`async void`, `CancellationToken`, excepciones específicas, analyzers como error) y se incluye C# en la lista de lenguajes del agente.
- **Overlays de Spring, .NET y Angular más profundos.** Spring: virtual threads y `@Async` con executor explícito, Resilience4j, `@Cacheable` con clave y TTL, Actuator + Micrometer, `readOnly` en lecturas, la trampa del proxy de `@Transactional` en llamadas internas, y slices de test frente a `@SpringBootTest`. .NET: `CancellationToken` propagado, `IHttpClientFactory` con typed clients y resiliencia, `HybridCache`, OpenTelemetry y health checks, `MapGroup` con filtros, la captura de `Scoped` desde `Singleton`, `Nullable`/`TreatWarningsAsErrors`, y sustitución de dependencias vía `ConfigureTestServices`. Angular: `@defer`, `computed` frente a `effect`, `linkedSignal`, rutas lazy con guards funcionales y `withComponentInputBinding`, interceptores funcionales, formularios reactivos tipados, `NgOptimizedImage`, accesibilidad y presupuestos de bundle.

### Fixed
- **La detección solo miraba la raíz del repo.** En .NET el layout normal es `Proyecto/Proyecto.csproj` o `src/App/App.csproj`, así que un proyecto C# perfectamente estándar no se detectaba y había que pasar `--stack` a mano. Ahora, **si y solo si** en la raíz no hay nada reconocible, se buscan subdirectorios en anchura (hasta 3 niveles, máximo 250 directorios, saltando `node_modules`, `bin`, `obj`, `target`, `dist`, `packages`…). La raíz sigue teniendo prioridad absoluta, así que ningún proyecto que ya se detectaba cambia de resultado. El instalador informa de por dónde lo detectó (`backend/dotnet (por PruebaConteo/, no por la raíz)`) para que la decisión sea auditable. Coste medido: 156 ms en un repo de 422 directorios sin nada detectable.
- **Detección de Spring incompleta**: se exigía la cadena literal `spring-boot` en el `pom.xml`, así que un proyecto que solo declara `org.springframework` (BOM o Spring Framework sin Boot) no se detectaba; y los `settings.gradle`/`settings.gradle.kts` no se miraban en absoluto. Ahora se buscan varias señales en los cinco archivos de build.
- **Un proyecto Java sin Spring quedaba en un callejón sin salida**: la detección devolvía `null` sin explicar nada y, con `--yes`, el instalador salía con código 1 a secas. Ahora imprime qué vio (`pom.xml`/`build.gradle`), aclara que el overlay de Java del kit es Spring Boot y avisa de que para Quarkus, Micronaut o Jakarta EE puro ese overlay no encaja. Misma pista para ecosistemas sin overlay (Go, Rust) y para un `package.json` sin framework reconocido.
- **`validate.cjs` verifica que el README no mienta.** El README se había desviado en silencio: listaba helpers borrados dos releases antes, 9 de los 13 stacks, "los 8 stacks" del CI y ejemplos pineados a `#v1.2.0`. Ahora se comprueban contra el repo los conteos de agentes, skills y stacks (los del árbol y los del CI), la lista de helpers, los stacks por categoría, el número de componentes descartados, y que todo ejemplo `#vX.Y.Z` apunte a la versión de `package.json`. Si una de esas frases desaparece, falla explícitamente en vez de dejar de comprobar: 38 → 49 comprobaciones.

## [2.1.0] - 2026-08-08

Correcciones salidas de instalar el kit en un proyecto real, más la regla de cadena de suministro y el resumen del proyecto.

### Fixed
- **Instalación no interactiva rota**: sin TTY, `readline` emitía todas las líneas de golpe y las que llegaban antes de registrarse `rl.question()` se perdían; la promesa nunca resolvía y el proceso **salía a medias con código 0** (instalación parcial reportada como éxito). Ahora `stdin` se drena a una cola —`printf 'y\nn\n' | node install.js` funciona— y al agotarse se usan los defaults. En TTY, `EOF`/Ctrl-D ya no deja la promesa colgada.
- **`--yes` sin stack detectable** se quedaba esperando en el prompt "Elige stack" y salía en verde. Ahora falla con **código 1** y dice qué hacer (`--stack <category/stack>`).
- **`.gitignore` ignoraba los ejemplos de env**: el patrón `.env.*` capturaba el `.env.example` que crea el propio instalador (y cualquier `.env.sample` ya versionado). Se añaden las negaciones `!.env.example`, `!.env.sample`, `!.env.template` **después** del patrón. Mismo arreglo en el `.gitignore` del kit.
- **husky fuera de un repo git**: `maybeSetupHusky` llamaba a `npx husky init` sin comprobar que hubiera repositorio; fallaba dejando las devDeps instaladas. Ahora se omite con el motivo y el remedio (`git init`).
- **`--dry-run`** no marcaba como simulada la creación de `.env.example`.

### Added
- **`--update` ya no pierde nada tuyo.** Antes sobrescribía la capa base a ciegas: si habías personalizado `settings.json` (permisos, hooks propios, `env`) o editado un agente, se perdía y tocaba reconciliarlo a mano desde el backup — justo el retrabajo que el kit existe para evitar. Ahora la instalación escribe `.claude/.kit-manifest.json` con el hash de cada archivo tal como lo dejó el kit, y en la actualización eso distingue lo intacto de lo editado: lo intacto se actualiza; lo que editaste y el kit no cambió se respeta sin ruido; lo que editaron ambos se conserva y la versión nueva queda como `*.kit-new` con el `diff` impreso. `settings.json` se **fusiona** (unión de `permissions`, el kit solo reemplaza sus propias entradas de `hooks`, tus valores de `env` ganan, tu `statusLine` propio se respeta, y las claves que hayas añadido siguen). El informe final dice cuántos archivos se añadieron, actualizaron, respetaron o quedaron en conflicto.
- **Regla de cadena de suministro (baseline §6.1) + su control ejecutable**: antes de instalar algo (dependencia, skill, agente, plugin, MCP, action) o de correr un comando que toque el sistema, hay que validar que sea seguro. El hook `pre-bash` la aplica en tres niveles: **`deny`** para lo destructivo o fuera del proyecto (`curl | sh`, `sudo`, instalación global, `publish`, rutas del sistema, `~/.ssh`, `dd`, `chmod 777`, `--no-verify`); **`ask`** para lo que mete código de terceros nuevo (deps, `npx`, componentes de claude-code-templates), con la checklist de verificación —typosquatting, publisher, versión pineada, scripts `postinstall`— en el motivo que ve el modelo; y libre para lo que instala del lockfile o manifiesto del propio repo. `settings.json` deniega los mismos casos duros por permisos, por si los hooks están desactivados. 21 tests nuevos, incluido el falso positivo de `docker run --rm`.
- **Resumen del proyecto** al final de la instalación: proyecto, stack y lenguaje, framework, gestor de paquetes y deps, motores de datos, volumen de código, tests, calidad, entrega (CI/contenedores), monorepo, git y entorno. Los huecos frente a la baseline salen marcados con ⚠️. Es de solo lectura y nunca tumba una instalación correcta.
- **`validate.cjs`** aplica el check es-MX también a `install.js` (era el texto más leído del kit y estaba fuera de la comprobación).

### Changed
- **Instalar dependencias ahora pide confirmación.** La decisión `ask` del hook `pre-bash` gana sobre el allowlist de `permissions`, así que `npm install <pkg>`, `pip install <pkg>` y `npx <pkg>` preguntan aunque estuvieran permitidos. Es intencional —esa confirmación *es* la validación de §6.1— pero conviene saberlo si tenías flujos desatendidos: instalar desde el lockfile (`npm ci`, `npm install` sin argumentos, `pip install -r`) y `npx --no-install` siguen sin preguntar.

### Notas de actualización
- Ejecuta `npx -y github:lacasoft/dev-starter-kit#v2.1.0 --update --yes`. Fija la versión por tag: `npx` cachea las specs de GitHub y sin pinear puedes recibir una copia vieja.
- Los proyectos instalados con 2.0.x **no tienen manifiesto**, así que esta primera actualización es conservadora: preserva lo que hay y deja las versiones nuevas como `*.kit-new`. Si no habías editado nada, el instalador imprime el comando para aceptarlas todas de golpe. A partir de ahí las actualizaciones son limpias.

## [2.0.1] - 2026-06-11

### Fixed
- **CI**: el smoke-test deriva los stacks de `install.js` (`scripts/stacks.cjs`, fuente única) en vez de una lista hardcodeada; ahora cubre los 13 (django/dotnet/express/spring/nextjs ya entran en CI).
- **Permisos** (supply chain): se quitan los comodines `Bash(npx */pnpm */yarn *)` que permitían ejecutar paquetes arbitrarios de internet sin confirmación. Acotado a `npx claude-flow*`/`react-doctor*`, `pnpm run *`/`test*`, `yarn run *`/`test*`.
- **hook-handler**: comentarios honestos (el escáner de secretos bloquea con `permissionDecision: deny`, no "solo avisa").

### Changed
- README documenta el caso fullstack (un solo `package.json` → gana frontend; `--stack` para forzar). El check es-MX de `validate.cjs` cubre también `commands/`, `templates/` y `helpers/`.

## [2.0.0] - 2026-06-11

Hardening a partir de una revisión externa: el kit ahora **se aplica sus propias reglas** (supply chain, código muerto, tests, verificación, es-MX).

### Fixed (seguridad / correctitud)
- **Licencia/legal**: añade `LICENSE` MIT y `package.json` MIT; README corregido (era público sin licencia y decía "privado").
- **Timeouts de hooks** en segundos (estaban en ms → 5000 = ~83 min; la protección estaba anulada).
- **Escáner de secretos efectivo**: PreToolUse JSON `permissionDecision: deny` (el modelo recibe el motivo; antes `exit 0`+stderr era invisible) y cubre Write/Edit/**MultiEdit**.
- **Supply chain**: actions pineadas por SHA; `claude-flow@3.10.41` y `claude-code-templates@1.28.16` (no `@alpha`/`@latest`); `permissions: contents:read` en CI.
- **Permisos** ampliados (pytest, flutter, forge, composer, pnpm, turbo…) — antes solo npm.
- **Memoria** sin ruido: `import` ya no inyecta los marcadores "sesión sincronizada".

### Changed
- **Modelos**: los 14 agentes **heredan** el modelo de la sesión (sin `model:`); regla de modelo en swarm neutralizada.
- **es-MX** como regla exigible: sección Idioma en baseline, glosario en CONTRIBUTING y **check en `validate.cjs`** (falla CI ante peninsularismos). Corrige coste→costo, montar→configurar/armar, etc.
- Descriptions CSO (ci-cd, monorepo, performance-profiling, iac, ship-gate): "solo cuándo".
- Agentes con **un** `<example>` (antes dos → menos contexto fijo por sesión).
- **/monitoring:status → /kit:status** (rename). `framer-motion → motion`.
- `/docs/adr` se versiona (excepción a `/docs`).

### Added
- **Overlays**: `frontend/nextjs` (App Router — antes Next caía en Vite), `backend/express`, `backend/django`, `backend/spring`, `backend/dotnet`; detección actualizada (next antes que react).
- **Tests** del hook-handler con `node:test` (guards rm -rf/push --force, escáner de secretos, allowlist) + paso en CI.
- `validate.cjs` cruza `STACKS` ↔ overlays del filesystem.
- Instalador: scaffold de `.env.example` y setup opt-in de husky+lint-staged+commitlint+plantilla de PR.
- `coder`: estándares por lenguaje PHP/Java/Dart.

### Removed
- Código muerto: `router.cjs`, `intelligence.cjs` y el hook `UserPromptSubmit` de routing (nadie los consumía).

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
