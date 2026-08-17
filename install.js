#!/usr/bin/env node
/**
 * install.js — Instalador del Dev Starter Kit (capa coherente + enjambre híbrido).
 *
 * Hace:
 *  1. Detecta el stack (category/stack) o lo pides tú.
 *  2. Backup de .claude/ y copia la capa base (shared/.claude → .claude): agentes, skills, helpers, settings, comandos.
 *  3. Scaffolda CLAUDE.project.md y compone ./CLAUDE.md (project + base + común + stack) en bloque gestionado.
 *  4. Actualiza .gitignore (memoria/runtime/backups/secretos).
 *  5. (opcional) Orquesta claude-flow init para el enjambre real (primero; nuestra capa va encima sin pisarlo).
 *  6. (opcional) Instala agentes/skills externos curados (claude-code-templates) y deps npm por stack.
 *  7. Indica los plugins de Claude Code a añadir (shared + por-stack).
 *  8. Imprime un resumen del proyecto (stack, tests, calidad, entrega, git, entorno) y sus huecos.
 *
 * Flags:
 *   --stack <cat/stack>  fuerza el stack (si no, autodetecta)
 *   --yes, -y            no interactivo: usa el default de cada confirmación
 *   --all                acepta TODO (claude-flow + externos + deps). Combina con --yes para desatendido total
 *   --no-flow            no ejecuta claude-flow init
 *   --no-external        no instala componentes externos (claude-code-templates / npm)
 *   --update, --force    sobrescribe la capa base con la última versión (conserva memoria y CLAUDE.project.md)
 *   --dry-run            simula: imprime qué haría, no escribe ni ejecuta
 *   --help, -h           muestra esta ayuda
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const crypto = require("crypto");
const { execSync } = require("child_process");

const KIT = path.resolve(__dirname);
const CWD = process.cwd();
const argv = process.argv.slice(2);
const FLAGS = {
  yes: argv.includes("--yes") || argv.includes("-y"),
  all: argv.includes("--all"),
  noFlow: argv.includes("--no-flow"),
  noExternal: argv.includes("--no-external"),
  update: argv.includes("--update") || argv.includes("--force"),
  dryRun: argv.includes("--dry-run"),
  help: argv.includes("--help") || argv.includes("-h"),
  stack:
    argv.includes("--stack") &&
    argv[argv.indexOf("--stack") + 1] &&
    !argv[argv.indexOf("--stack") + 1].startsWith("--")
      ? argv[argv.indexOf("--stack") + 1]
      : null,
};

if (FLAGS.help) {
  console.log(`
Dev Starter Kit — instalador (.claude)

Uso:  node install.js [opciones]

  --stack <cat/stack>  fuerza el stack (backend/nestjs, frontend/react, mobile/flutter, ...)
  --yes, -y            no interactivo: usa el default de cada confirmación (conservador)
  --all                acepta TODO (claude-flow + externos + deps). Usa "--yes --all" para desatendido total
  --no-flow            no ejecuta claude-flow init
  --no-external        no instala componentes externos
  --update, --force    actualiza la capa base sin perder nada tuyo: solo reescribe los archivos
                       que siguen igual que como los dejó el kit (según .claude/.kit-manifest.json).
                       Lo que hayas editado se conserva y la versión nueva queda como *.kit-new.
                       settings.json se FUSIONA (tus permisos, hooks y env se mantienen).
                       Memoria y CLAUDE.project.md intactos. Hace backup antes.
  --dry-run            simula sin escribir ni ejecutar
  --help, -h           esta ayuda

Sin TTY (CI, agentes, tuberías) puedes pipear las respuestas una por línea
—  printf 'y\\nn\\n' | node install.js  — y al agotarse se usan los defaults.
Con --yes el stack debe ser detectable o venir en --stack, o sale con error.

Hace: backup de .claude → aplica capa base (agentes/skills/helpers/settings) →
      compone CLAUDE.md (base+común+stack) + CLAUDE.project.md → actualiza .gitignore →
      (opc.) claude-flow init → (opc.) externos → indica plugins de Claude Code.
`);
  process.exit(0);
}

// ---------- entrada del usuario ----------
// stdin no siempre es un TTY (CI, `printf 'y\ny\n' | node install.js`, agentes). readline en
// modo no-TTY emite todas las líneas de golpe: las que llegan antes de que se registre
// rl.question() se pierden, la promesa nunca resuelve y el proceso se vacía a medias.
// Por eso: con TTY, readline; sin TTY, se drena stdin a una cola y cada ask() consume una línea.
const TTY = process.stdin.isTTY === true;
let rl = null;
let pipedLines = null;

function closeInput() {
  if (rl) {
    rl.close();
    rl = null;
  }
}
function nextPipedLine() {
  if (pipedLines === null) {
    let raw = "";
    try {
      raw = fs.readFileSync(0, "utf8");
    } catch (_) {
      raw = "";
    }
    pipedLines = raw.split(/\r?\n/);
    while (pipedLines.length && pipedLines[pipedLines.length - 1] === "") pipedLines.pop();
  }
  return pipedLines.length ? pipedLines.shift() : null;
}

// Devuelve null cuando no hay respuesta posible (no interactivo, o stdin agotado/cerrado).
async function ask(q) {
  if (FLAGS.yes) return null;
  if (!TTY) {
    const line = nextPipedLine();
    if (line === null) return null;
    console.log(`${q}${line}`);
    return line;
  }
  if (!rl) rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const r = rl;
  return new Promise((resolve) => {
    const onClose = () => resolve(null); // Ctrl-D / EOF: no dejamos la promesa colgada
    r.once("close", onClose);
    r.question(q, (a) => {
      r.off("close", onClose);
      resolve(a);
    });
  });
}
async function confirm(q, def = true) {
  const a = await ask(`${q} ${def ? "(Y/n)" : "(y/N)"}: `);
  if (a === null) return def;
  const v = a.trim().toLowerCase();
  if (!v) return def;
  return v === "y" || v === "s" || v === "yes" || v === "si";
}
function run(cmd) {
  console.log(`\n$ ${cmd}`);
  if (FLAGS.dryRun) return true;
  try {
    execSync(cmd, { stdio: "inherit" });
    return true;
  } catch (e) {
    console.error(`  ⚠️  Falló: ${e.message}`);
    return false;
  }
}

// ---------- detección de stack ----------
function readJSON(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return null;
  }
}
function fileHas(p, re) {
  try {
    return re.test(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return false;
  }
}
function hasFile(...names) {
  return names.some((n) => fs.existsSync(path.join(CWD, n)));
}
function dirHasExt(re) {
  try {
    return fs.readdirSync(CWD).some((f) => re.test(f));
  } catch (_) {
    return false;
  }
}
// Archivos de build de Java/Kotlin. Un proyecto Java NO es necesariamente Spring.
const JAVA_BUILD_FILES = ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"];
const javaBuildFiles = () => JAVA_BUILD_FILES.filter((f) => fs.existsSync(path.join(CWD, f)));

// Spring se declara de muchas formas: starters, BOM, plugin de Gradle, imports del framework.
// Antes solo se miraba /spring-boot/ en pom.xml y /spring/ en build.gradle, así que un Gradle
// con Kotlin DSL o un proyecto Spring sin la palabra exacta se quedaba sin detectar.
const SPRING_SIGNALS = /spring-boot|spring-framework|org\.springframework|io\.spring\.dependency-management/i;
const isSpringProject = () => javaBuildFiles().some((f) => fileHas(path.join(CWD, f), SPRING_SIGNALS));

// Qué se vio en el directorio cuando la detección falla. Sin esto el usuario solo recibe
// "no se pudo detectar" y tiene que adivinar por qué.
function detectionHint() {
  const java = javaBuildFiles();
  if (java.length) {
    return `Vi ${java.join(", ")}: es un proyecto Java/Kotlin, pero no encontré señales de Spring.\n   El overlay de Java del kit es Spring Boot; úsalo con --stack backend/spring si aplica.\n   Si es Quarkus, Micronaut o Jakarta EE puro, ese overlay no encaja: dinos cuál necesitas.`;
  }
  if (fs.existsSync(path.join(CWD, "go.mod"))) return "Vi go.mod: aún no hay overlay de Go en el kit.";
  if (fs.existsSync(path.join(CWD, "Cargo.toml"))) return "Vi Cargo.toml: aún no hay overlay de Rust en el kit.";
  if (fs.existsSync(path.join(CWD, "package.json"))) return "Vi package.json pero ningún framework reconocido en sus dependencias.";
  return "No vi ningún archivo de proyecto reconocible en este directorio.";
}

function detectStack() {
  const pkg = readJSON(path.join(CWD, "package.json")) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const req = path.join(CWD, "requirements.txt");
  const pyproj = path.join(CWD, "pyproject.toml");
  // mobile
  if (fs.existsSync(path.join(CWD, "pubspec.yaml"))) return "mobile/flutter";
  if (deps["react-native"] || deps["expo"]) return "mobile/react-native";
  // frontend
  if (fs.existsSync(path.join(CWD, "angular.json")) || deps["@angular/core"]) return "frontend/angular";
  if (hasFile("next.config.js", "next.config.mjs", "next.config.ts") || deps["next"]) return "frontend/nextjs"; // antes que react
  // backend específicos
  if (fs.existsSync(path.join(CWD, "nest-cli.json")) || deps["@nestjs/core"]) return "backend/nestjs";
  if (fs.existsSync(path.join(CWD, "foundry.toml"))) return "blockchain/solidity";
  if (dirHasExt(/\.(csproj|sln)$/)) return "backend/dotnet";
  if (isSpringProject()) return "backend/spring";
  if (fs.existsSync(path.join(CWD, "manage.py")) || fileHas(req, /(^|\n)\s*django\b/i) || fileHas(pyproj, /\bdjango\b/i)) return "backend/django";
  if (fs.existsSync(path.join(CWD, "composer.json"))) return "backend/php";
  if (fileHas(req, /fastapi/i) || fileHas(pyproj, /fastapi/i)) return "backend/fastapi";
  // frontend genérico (después de next)
  if (deps["react"] && deps["react-dom"]) return "frontend/react";
  // backend JS genérico (Express/Fastify/Koa) — al final, ya descartados los frontends
  if (deps["express"] || deps["fastify"] || deps["koa"]) return "backend/express";
  return null;
}

const STACKS = {
  "backend/nestjs": 1, "backend/express": 1, "backend/fastapi": 1, "backend/django": 1,
  "backend/php": 1, "backend/spring": 1, "backend/dotnet": 1,
  "frontend/angular": 1, "frontend/react": 1, "frontend/nextjs": 1,
  "mobile/react-native": 1, "mobile/flutter": 1,
  "blockchain/solidity": 1,
};

// ---------- aplicación de la capa base ----------
// El manifiesto (.claude/.kit-manifest.json) guarda el hash de cada archivo TAL COMO lo instaló
// el kit. Con eso, en una actualización se distingue "esto no lo ha tocado nadie" de "esto lo
// editó el usuario", y nunca se pisa trabajo ajeno.
const MANIFEST_FILE = ".kit-manifest.json";
const hash = (buf) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);

// Reglas por archivo:
//  - no existe                                  → se crea
//  - idéntico al del kit                        → no se toca
//  - sin --update                               → se conserva el tuyo (skip-existing)
//  - --update y coincide con el manifiesto      → intacto desde la última instalación: se actualiza
//  - --update y NO coincide (lo editaste, o no  → se conserva el tuyo y la versión nueva se deja
//    hay manifiesto de una instalación previa)     al lado como *.kit-new. Nunca se pierde nada.
function applyLayer(src, dest, ctx, base) {
  base = base || src;
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    const rel = path.relative(base, s).split(path.sep).join("/");
    if (ctx.skip && ctx.skip(rel)) {
      console.log(`  ⏭️  omitido (claude-flow lo cubre): ${rel}`);
      continue;
    }
    if (entry.isDirectory()) {
      if (!FLAGS.dryRun) fs.mkdirSync(d, { recursive: true });
      applyLayer(s, d, ctx, base);
      continue;
    }
    const dry = FLAGS.dryRun ? "(dry-run) " : "";
    const shown = path.relative(CWD, d);
    const existed = fs.existsSync(d);

    // settings.json es el archivo que la gente personaliza (permisos, hooks propios, env).
    // En una actualización se FUSIONA, jamás se reemplaza.
    if (rel === "settings.json" && existed && FLAGS.update) {
      const text = JSON.stringify(mergeSettings(s, d), null, 2) + "\n";
      ctx.next[rel] = hash(Buffer.from(text));
      if (hash(fs.readFileSync(d)) === ctx.next[rel]) {
        ctx.same++;
        continue;
      }
      if (!FLAGS.dryRun) fs.writeFileSync(d, text);
      console.log(`  ${dry}🔀 ${shown} (fusionado: tus permisos, hooks y env se conservan)`);
      ctx.merged = true;
      continue;
    }

    const srcBuf = fs.readFileSync(s);
    ctx.next[rel] = hash(srcBuf);
    if (!existed) {
      if (!FLAGS.dryRun) fs.writeFileSync(d, srcBuf);
      console.log(`  ${dry}➕ ${shown}`);
      ctx.added++;
      continue;
    }
    const destHash = hash(fs.readFileSync(d));
    if (destHash === ctx.next[rel]) {
      ctx.same++;
      continue;
    }
    if (!FLAGS.update) {
      ctx.kept++;
      continue;
    }
    if (ctx.prev[rel] === destHash) {
      if (!FLAGS.dryRun) fs.writeFileSync(d, srcBuf);
      console.log(`  ${dry}⬆️  ${shown}`);
      ctx.updated++;
    } else if (ctx.prev[rel] === ctx.next[rel]) {
      // Lo editaste tú y el kit NO ha cambiado este archivo: no hay versión nueva que ofrecerte.
      ctx.userOwned++;
    } else {
      if (!FLAGS.dryRun) fs.writeFileSync(`${d}.kit-new`, srcBuf);
      console.log(`  ${dry}⚠️  ${shown} — lo tuyo se conserva, la versión nueva queda en ${entry.name}.kit-new`);
      ctx.conflicts.push(shown);
    }
  }
}

// Fusiona el settings.json del kit con el tuyo sin perder nada:
//  - hooks: el kit solo reemplaza SUS entradas (las que apuntan a sus helpers); las tuyas siguen.
//  - permisos: unión sin duplicados.
//  - env: tus valores ganan.  - statusLine: si apunta a otra cosa, se respeta.
//  - cualquier otra clave que hayas añadido se conserva tal cual.
const isKitHook = (g) =>
  Array.isArray(g && g.hooks) && g.hooks.length > 0 && g.hooks.every((h) => /hook-handler\.cjs|auto-memory-hook\.mjs/.test((h && h.command) || ""));

function mergeSettings(kitPath, destPath) {
  const kit = readJSON(kitPath) || {};
  const cur = readJSON(destPath) || {};
  const out = { ...cur };
  if (kit.$schema) out.$schema = kit.$schema;

  const hooks = { ...(cur.hooks || {}) };
  for (const ev of new Set([...Object.keys(kit.hooks || {}), ...Object.keys(cur.hooks || {})])) {
    const tuyos = (cur.hooks[ev] || []).filter((g) => !isKitHook(g));
    const merged = [...(kit.hooks?.[ev] || []), ...tuyos];
    if (merged.length) hooks[ev] = merged;
    else delete hooks[ev];
  }
  out.hooks = hooks;

  const perms = { ...(cur.permissions || {}) };
  for (const k of new Set([...Object.keys(kit.permissions || {}), ...Object.keys(cur.permissions || {})])) {
    const a = kit.permissions?.[k];
    const b = cur.permissions?.[k];
    // allow/deny/ask son listas (se unen); defaultMode y similares son escalares (gana el tuyo).
    if (Array.isArray(a) || Array.isArray(b)) perms[k] = [...new Set([...(a || []), ...(b || [])])];
    else perms[k] = b !== undefined ? b : a;
  }
  out.permissions = perms;

  out.env = { ...(kit.env || {}), ...(cur.env || {}) };
  const propia = cur.statusLine && !/statusline\.cjs/.test(JSON.stringify(cur.statusLine));
  if (!propia && kit.statusLine) out.statusLine = kit.statusLine;
  return out;
}

function reportLayer(ctx) {
  const l = [];
  if (ctx.added) l.push(`${ctx.added} nuevos`);
  if (ctx.updated) l.push(`${ctx.updated} actualizados`);
  if (ctx.same) l.push(`${ctx.same} ya al día`);
  if (ctx.kept) l.push(`${ctx.kept} conservados (usa --update para actualizarlos)`);
  if (ctx.userOwned) l.push(`${ctx.userOwned} tuyos respetados (los editaste y el kit no los cambió)`);
  if (ctx.merged) l.push("settings.json fusionado");
  if (l.length) console.log(`  📋 ${l.join(" · ")}`);
  if (ctx.conflicts.length) {
    console.log(`\n  ⚠️  ${ctx.conflicts.length} archivo(s) con cambios que no instaló el kit: se conservan intactos.`);
    console.log("     La versión nueva quedó al lado como *.kit-new. Compara y quédate con lo que quieras:");
    ctx.conflicts.slice(0, 10).forEach((f) => console.log(`       diff ${f} ${f}.kit-new`));
    if (ctx.conflicts.length > 10) console.log(`       ...y ${ctx.conflicts.length - 10} más.`);
    // Caso habitual: no editaste nada, solo faltaba el manifiesto. Que aceptarlo todo sea un comando.
    console.log("\n     Si no habías editado ninguno y quieres quedarte con las versiones nuevas:");
    console.log(`       find .claude -name '*.kit-new' -exec sh -c 'mv "$1" "\${1%.kit-new}"' _ {} \\;`);
  }
}

function mcpHasFlow() {
  const m = readJSON(path.join(CWD, ".mcp.json"));
  return !!(m && m.mcpServers && Object.keys(m.mcpServers).some((k) => /flow/i.test(k)));
}

const GITIGNORE = [".claude/memory/", ".claude-flow/", ".swarm/", ".claude.backup.*", ".env", ".env.*"];
// Los archivos de ejemplo de env van versionados (la baseline los exige), pero ".env.*" los
// captura. Git aplica la última regla que casa, así que las negaciones van SIEMPRE después.
const GITIGNORE_KEEP = ["!.env.example", "!.env.sample", "!.env.template"];

// Asegura que .gitignore cubra memoria/runtime/backups/secretos (idempotente).
function ensureGitignore() {
  const gi = path.join(CWD, ".gitignore");
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
  const add = GITIGNORE.filter((n) => !have.has(n));
  // Si acabamos de añadir ".env.*", reemitimos las negaciones aunque ya existan más arriba:
  // colocadas antes del patrón no harían nada, y la línea duplicada es inocua.
  const keep = GITIGNORE_KEEP.filter((n) => !have.has(n) || add.includes(".env.*"));
  const lines = [...add, ...keep];
  if (!lines.length) {
    console.log("  ✓ .gitignore ya cubre memoria/runtime/secretos.");
    return;
  }
  if (FLAGS.dryRun) {
    console.log(`  (dry-run) añadiría a .gitignore: ${lines.join(", ")}`);
    return;
  }
  const block = (cur && !cur.endsWith("\n") ? "\n" : "") + "\n# dev-starter-kit\n" + lines.join("\n") + "\n";
  fs.writeFileSync(gi, cur + block);
  console.log(`  ➕ .gitignore += ${lines.join("  ")}`);
}

// ---------- composición de CLAUDE.md ----------
const MB = "<!-- BEGIN dev-starter-kit overlay -->";
const ME = "<!-- END dev-starter-kit overlay -->";
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function readMaybe(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").trim() : "";
}
async function scaffoldProject() {
  const dest = path.join(CWD, "CLAUDE.project.md");
  if (fs.existsSync(dest)) {
    console.log("  ✓ CLAUDE.project.md ya existe (se conserva).");
    return true;
  }
  const tpl = path.join(KIT, "shared", "templates", "PROJECT.template.md");
  if (!fs.existsSync(tpl)) return false;
  if (await confirm("¿Crear plantilla de definición del proyecto (CLAUDE.project.md)?", true)) {
    let content = fs.readFileSync(tpl, "utf8");
    const name = (readJSON(path.join(CWD, "package.json")) || {}).name || path.basename(CWD);
    content = content.replace(/\{\{NOMBRE_DEL_PROYECTO\}\}/g, name);
    if (FLAGS.dryRun) {
      console.log("  (dry-run) ➕ ./CLAUDE.project.md");
    } else {
      fs.writeFileSync(dest, content);
      console.log("  ➕ ./CLAUDE.project.md (rellénalo con el contexto real del proyecto)");
    }
    return true;
  }
  return false;
}

function composeClaudeMd(stackId, hasProject) {
  const [cat, st] = stackId.split("/");
  const common = readMaybe(path.join(KIT, "stacks", cat, "_common", ".claude", "CLAUDE.md"));
  const specific = readMaybe(path.join(KIT, "stacks", cat, st, ".claude", "CLAUDE.md"));
  const imports = [];
  if (hasProject) imports.push("@CLAUDE.project.md");
  imports.push("@.claude/CLAUDE.base.md");
  const overlay = [...imports, common, specific].filter(Boolean).join("\n\n");
  const block = `${MB}\n${overlay}\n${ME}\n`;
  const root = path.join(CWD, "CLAUDE.md");
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  if (!fs.existsSync(root)) {
    if (!FLAGS.dryRun) fs.writeFileSync(root, block);
    console.log(`  ${dry}➕ ./CLAUDE.md (base + común + stack)`);
  } else {
    let cur = fs.readFileSync(root, "utf8");
    const re = new RegExp(`${esc(MB)}[\\s\\S]*?${esc(ME)}\\n?`);
    cur = re.test(cur) ? cur.replace(re, block) : cur.trimEnd() + "\n\n" + block;
    if (!FLAGS.dryRun) fs.writeFileSync(root, cur);
    console.log(`  ${dry}🔁 ./CLAUDE.md (bloque dev-starter-kit actualizado)`);
  }
}

// ---------- manifiesto ----------
const manifest = readJSON(path.join(KIT, "components.json")) || {};
function cctFor(stackId) {
  const [cat] = stackId.split("/");
  const agents = [];
  const skills = [];
  for (const a of manifest.shared?.agents || []) agents.push(a.id);
  for (const s of manifest.shared?.skills || []) skills.push(s.id);
  const sc = manifest.stacks?.[cat] || {};
  for (const a of sc.agents || []) if (a.rec === "integrar") agents.push(a.id);
  for (const s of sc.skills || []) if (s.rec === "integrar") skills.push(s.id);
  return { agents: [...new Set(agents)], skills: [...new Set(skills)] };
}

// Crea .env.example (la baseline lo exige versionado) si falta y el proyecto usa env.
async function scaffoldEnvExample() {
  const dest = path.join(CWD, ".env.example");
  if (fs.existsSync(dest)) return;
  const usesEnv = ["package.json", "pyproject.toml", "requirements.txt", "composer.json", "go.mod", "pom.xml", ".env"].some((f) =>
    fs.existsSync(path.join(CWD, f))
  );
  if (!usesEnv) return;
  if (!(await confirm("¿Crear .env.example (placeholders de las env vars)?", true))) return;
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  const body = [
    "# .env.example — variables de entorno del proyecto (SIN valores reales).",
    "# Cópialo a .env (gitignored) y rellena. Documenta aquí cada variable nueva.",
    "# Regla del kit: nada hardcodeado; toda config que cambie entre entornos va aquí.",
    "",
    "# NODE_ENV=development",
    "# DATABASE_URL=",
    "# REDIS_URL=",
    "",
  ].join("\n");
  if (!FLAGS.dryRun) fs.writeFileSync(dest, body);
  console.log(`  ${dry}➕ ./.env.example (rellénalo y añade tus variables)`);
}

function isGitRepo() {
  if (fs.existsSync(path.join(CWD, ".git"))) return true;
  try {
    execSync("git rev-parse --is-inside-work-tree", { cwd: CWD, stdio: "ignore" });
    return true;
  } catch (_) {
    return false;
  }
}

// Ofrece tooling de git que la baseline exige (husky + lint-staged + commitlint + plantilla de PR).
async function maybeSetupHusky() {
  const pkgPath = path.join(CWD, "package.json");
  if (!fs.existsSync(pkgPath)) return; // solo proyectos Node
  const pkg = readJSON(pkgPath) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  if (deps.husky) {
    console.log("  ✓ husky ya presente.");
    return;
  }
  console.log("\n🪝 Git hooks: husky + lint-staged + commitlint + plantilla de PR (la baseline los exige).");
  if (!isGitRepo()) {
    // `npx husky init` falla fuera de un repo, y las devDeps quedarían instaladas para nada.
    console.log("  → Omitido: esto no es un repositorio git. Ejecuta `git init` y relanza el instalador.");
    return;
  }
  if (!(await confirm("¿Configurarlos ahora? (instala devDeps)", FLAGS.all))) {
    console.log("  → Omitido. Hazlo luego o la regla aplica solo 'si el repo los tiene'.");
    return;
  }
  if (run("npm install -D husky lint-staged @commitlint/cli @commitlint/config-conventional") && run("npx husky init")) {
    if (!FLAGS.dryRun) {
      try {
        fs.writeFileSync(path.join(CWD, "commitlint.config.cjs"), 'module.exports = { extends: ["@commitlint/config-conventional"] };\n');
        fs.writeFileSync(path.join(CWD, ".husky", "commit-msg"), 'npx --no-install commitlint --edit "$1"\n');
        fs.writeFileSync(path.join(CWD, ".husky", "pre-commit"), "npx --no-install lint-staged\n");
        const prDir = path.join(CWD, ".github");
        fs.mkdirSync(prDir, { recursive: true });
        fs.writeFileSync(
          path.join(prDir, "pull_request_template.md"),
          "## Summary\n\n## Test plan\n- [ ] \n"
        );
        console.log("  ➕ commitlint.config.cjs, .husky/{commit-msg,pre-commit}, .github/pull_request_template.md");
      } catch (e) {
        console.error(`  ⚠️  ${e.message}`);
      }
    }
  }
}

// ---------- resumen del proyecto ----------
// Radiografía barata y de solo lectura del repo destino: lo que el kit ha podido inferir.
// No sustituye a CLAUDE.project.md (el contexto de negocio lo pones tú), pero da el mapa.
const SKIP_DIRS = new Set([
  "node_modules", "dist", "build", "out", "coverage", "vendor", "target", "bin", "obj",
  "venv", "__pycache__", "Pods", "artifacts", "cache", "tmp", "logs",
]);
const CODE_EXT = {
  "backend/nestjs": [".ts"],
  "backend/express": [".ts", ".js", ".mjs"],
  "backend/fastapi": [".py"],
  "backend/django": [".py"],
  "backend/php": [".php"],
  "backend/spring": [".java", ".kt"],
  "backend/dotnet": [".cs"],
  "frontend/angular": [".ts", ".html", ".scss"],
  "frontend/react": [".ts", ".tsx", ".js", ".jsx"],
  "frontend/nextjs": [".ts", ".tsx", ".js", ".jsx"],
  "mobile/react-native": [".ts", ".tsx", ".js", ".jsx"],
  "mobile/flutter": [".dart"],
  "blockchain/solidity": [".sol"],
};
const FRAMEWORK_DEP = {
  "backend/nestjs": "@nestjs/core",
  "backend/express": "express",
  "frontend/nextjs": "next",
  "frontend/react": "react",
  "frontend/angular": "@angular/core",
  "mobile/react-native": "react-native",
};
const IS_TEST = /(^test_|_test\.|\.(test|spec)\.|Tests?\.(cs|java|kt)$)/i;
const ENV_FILES = [".env.example", ".env.sample", ".env.template"];

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: CWD, stdio: ["ignore", "pipe", "ignore"] }).toString().trim() || null;
  } catch (_) {
    return null;
  }
}
function walkCode(exts, limit = 5000) {
  const out = { files: 0, lines: 0, tests: 0, truncated: false };
  const queue = [CWD];
  while (queue.length) {
    let entries = [];
    const dir = queue.shift();
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
        queue.push(path.join(dir, e.name));
      } else if (exts.includes(path.extname(e.name))) {
        if (out.files >= limit) {
          out.truncated = true;
          continue;
        }
        out.files++;
        if (IS_TEST.test(e.name)) out.tests++;
        try {
          const p = path.join(dir, e.name);
          if (fs.statSync(p).size <= 512 * 1024) out.lines += fs.readFileSync(p, "utf8").split("\n").length;
        } catch (_) {}
      }
    }
  }
  return out;
}
function projectIdentity() {
  const pkg = readJSON(path.join(CWD, "package.json"));
  if (pkg?.name) return `${pkg.name}${pkg.version ? ` v${pkg.version}` : ""}`;
  const composer = readJSON(path.join(CWD, "composer.json"));
  if (composer?.name) return composer.name;
  for (const [f, re] of [["pubspec.yaml", /^name:\s*(\S+)/m], ["pyproject.toml", /^name\s*=\s*["']([^"']+)/m]]) {
    const m = readMaybe(path.join(CWD, f)).match(re);
    if (m) return m[1];
  }
  return path.basename(CWD);
}
function packageManager() {
  const locks = [
    ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lockb", "bun"], ["package-lock.json", "npm"],
    ["poetry.lock", "poetry"], ["uv.lock", "uv"], ["Pipfile.lock", "pipenv"], ["composer.lock", "composer"],
    ["Gemfile.lock", "bundler"], ["pubspec.lock", "pub"], ["go.sum", "go"], ["Cargo.lock", "cargo"],
  ];
  return locks.filter(([f]) => fs.existsSync(path.join(CWD, f))).map(([, n]) => n);
}
// Variables realmente declaradas (no las comentadas de una plantilla vacía).
function envVars(file) {
  return readMaybe(path.join(CWD, file))
    .split(/\r?\n/)
    .map((l) => (l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/) || [])[1])
    .filter(Boolean);
}
const plural = (n, sing, pl) => `${n} ${n === 1 ? sing : pl}`;
function summarizeProject(stackId) {
  const pkg = readJSON(path.join(CWD, "package.json")) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const dep = (n) => (deps[n] ? String(deps[n]).replace(/^[\^~>=<\s]+/, "") : null);
  const present = (list) => list.filter((n) => deps[n]);
  const rows = [];
  const add = (label, value) => { if (value) rows.push([label, value]); };

  add("Proyecto", projectIdentity());

  const lang = [];
  if (fs.existsSync(path.join(CWD, "tsconfig.json"))) {
    lang.push(/"strict"\s*:\s*true/.test(readMaybe(path.join(CWD, "tsconfig.json"))) ? "TypeScript (strict)" : "TypeScript");
  }
  if (pkg.engines?.node) lang.push(`Node ${pkg.engines.node}`);
  add("Stack", [stackId, ...lang].join(" · "));

  const fw = FRAMEWORK_DEP[stackId] && dep(FRAMEWORK_DEP[stackId]);
  add("Framework", fw ? `${FRAMEWORK_DEP[stackId]} ${fw}` : null);

  const pm = packageManager();
  const depCount = Object.keys(pkg.dependencies || {}).length;
  const devCount = Object.keys(pkg.devDependencies || {}).length;
  add("Paquetes", [pm.join(" + ") || null, depCount || devCount ? `${depCount} deps · ${devCount} devDeps` : null].filter(Boolean).join(" · "));

  const data = present(["@prisma/client", "prisma", "typeorm", "drizzle-orm", "mongoose", "sequelize", "knex", "@mikro-orm/core"]);
  // Motores: se buscan en las deps y en las env DECLARADAS, nunca en los comentarios de una
  // plantilla (si no, el .env.example que crea el propio kit inventaría Redis/Postgres).
  const ENGINES = [["postgres", /postgres|\bpg\b/i], ["mysql", /mysql|mariadb/i], ["mongodb", /mongo/i], ["redis", /redis/i], ["sqlite", /sqlite/i]];
  const haystack = [Object.keys(deps).join(" "), ...ENV_FILES.flatMap(envVars)].join(" ");
  const engines = ENGINES.filter(([, re]) => re.test(haystack)).map(([n]) => n);
  add("Datos", [...data, ...engines].join(" · "));

  const code = walkCode(CODE_EXT[stackId] || [".ts", ".tsx", ".js", ".py", ".php", ".java", ".cs", ".dart", ".sol"]);
  add("Código", code.files ? `${plural(code.files, "archivo", "archivos")}${code.truncated ? "+" : ""} · ~${code.lines.toLocaleString("es")} líneas` : null);


  const runner = present(["jest", "vitest", "mocha", "@playwright/test", "cypress", "supertest"]);
  const pyTest = /pytest/i.test(readMaybe(path.join(CWD, "requirements.txt")) + readMaybe(path.join(CWD, "pyproject.toml")));
  add("Tests", [
    runner.join(" · ") || (pyTest ? "pytest" : null),
    code.tests ? plural(code.tests, "archivo de test", "archivos de test") : (code.files ? "⚠️ sin archivos de test detectados" : null),
  ].filter(Boolean).join(" · "));

  const quality = [];
  if (hasFile(".eslintrc", ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs", "eslint.config.js", "eslint.config.mjs") || deps.eslint) quality.push("eslint");
  if (hasFile(".prettierrc", ".prettierrc.json", ".prettierrc.js", "prettier.config.js") || deps.prettier) quality.push("prettier");
  if (hasFile("ruff.toml", ".ruff.toml") || /\[tool\.(ruff|black)\]/.test(readMaybe(path.join(CWD, "pyproject.toml")))) quality.push("ruff/black");
  if (hasFile("analysis_options.yaml")) quality.push("dart analyze");
  if (hasFile("phpstan.neon", "phpstan.neon.dist", "pint.json")) quality.push("phpstan/pint");
  if (hasFile(".editorconfig")) quality.push("editorconfig");
  // husky es tooling de Node: en Python/Flutter/PHP el equivalente es pre-commit o lefthook.
  const hooks = fs.existsSync(path.join(CWD, ".husky"))
    ? "husky"
    : hasFile(".pre-commit-config.yaml")
      ? "pre-commit"
      : hasFile("lefthook.yml", "lefthook.yaml")
        ? "lefthook"
        : null;
  quality.push(hooks || "⚠️ sin hooks de git");
  add("Calidad", quality.join(" · "));

  const delivery = [];
  if (hasFile("Dockerfile")) delivery.push("Dockerfile");
  if (hasFile("docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml")) delivery.push("docker-compose");
  try {
    const wf = fs.readdirSync(path.join(CWD, ".github", "workflows")).filter((f) => /\.ya?ml$/.test(f)).length;
    if (wf) delivery.push(`GitHub Actions (${wf})`);
  } catch (_) {}
  if (hasFile(".gitlab-ci.yml")) delivery.push("GitLab CI");
  if (hasFile("Makefile")) delivery.push("Makefile");
  add("Entrega", delivery.join(" · ") || "⚠️ sin CI ni contenedores");

  const mono = [];
  if (pkg.workspaces) mono.push("npm/yarn workspaces");
  if (hasFile("pnpm-workspace.yaml")) mono.push("pnpm workspaces");
  for (const [f, n] of [["turbo.json", "turborepo"], ["nx.json", "nx"], ["lerna.json", "lerna"]]) if (hasFile(f)) mono.push(n);
  add("Monorepo", mono.join(" · "));

  if (isGitRepo()) {
    const branch = sh("git rev-parse --abbrev-ref HEAD");
    const commits = sh("git rev-list --count HEAD");
    const dirty = (sh("git status --porcelain") || "").split("\n").filter(Boolean).length;
    const remote = (sh("git config --get remote.origin.url") || "").replace(/^git@([^:]+):/, "$1/").replace(/^https?:\/\//, "").replace(/\.git$/, "");
    add("Git", [
      branch,
      commits ? plural(Number(commits), "commit", "commits") : null,
      remote || "sin remoto",
      dirty ? plural(dirty, "cambio sin commitear", "cambios sin commitear") : "limpio",
    ].filter(Boolean).join(" · "));
  } else {
    add("Git", "⚠️ no es un repositorio git");
  }

  const envPresent = ENV_FILES.filter((f) => fs.existsSync(path.join(CWD, f)));
  add("Entorno", [
    ...(envPresent.length
      ? envPresent.map((f) => {
          const n = envVars(f).length;
          return `${f} (${n ? plural(n, "variable", "variables") : "plantilla vacía"})`;
        })
      : ["⚠️ sin archivo de ejemplo de env"]),
    fs.existsSync(path.join(CWD, ".env")) ? ".env local presente" : null,
  ].filter(Boolean).join(" · "));

  const scripts = ["dev", "start", "build", "test", "lint"].filter((s) => pkg.scripts?.[s]);
  add("Scripts", scripts.length ? scripts.map((s) => `${pm[0] === "npm" || !pm.length ? "npm run " : pm[0] + " "}${s}`).join(" · ") : null);

  console.log("\n📊 Resumen del proyecto");
  const width = Math.max(...rows.map(([l]) => l.length));
  for (const [label, value] of rows) console.log(`   ${label.padEnd(width)}  ${value}`);
  if (rows.some(([, v]) => v.includes("⚠️"))) console.log("\n   ⚠️ = hueco frente a la baseline del kit. Revísalo antes de dar el proyecto por listo.");
  console.log("   Rellena CLAUDE.project.md con lo que esto no puede inferir: dominio, decisiones y límites.");
}

// ---------- main ----------
async function main() {
  const VERSION = (readJSON(path.join(KIT, "package.json")) || {}).version || "?";
  console.log("\n╔════════════════════════════════════════════╗");
  console.log(`║   Dev Starter Kit v${VERSION} — instalador      `.slice(0, 45) + "║");
  console.log("╚════════════════════════════════════════════╝");

  let stackId = FLAGS.stack || detectStack();
  if (stackId && !STACKS[stackId]) {
    console.log(`⚠️  Stack "${stackId}" no reconocido.`);
    stackId = null;
  }
  if (stackId) {
    console.log(`\n✅ Stack detectado: ${stackId}`);
    if (!(await confirm("¿Es correcto?", true))) stackId = null;
  }
  if (!stackId) {
    if (!FLAGS.stack) console.log(`\n🔍 ${detectionHint()}`);
    console.log("\nStacks disponibles:\n  " + Object.keys(STACKS).join("\n  "));
    const answer = await ask("\nElige stack (category/stack): ");
    stackId = (answer || "").trim();
    if (!STACKS[stackId]) {
      console.error(
        answer === null
          ? "\n❌ No se pudo detectar el stack y no hay entrada interactiva disponible.\n   Relanza indicándolo: node install.js --stack <category/stack>"
          : `\n❌ Stack inválido: "${stackId}"`
      );
      closeInput();
      process.exitCode = 1; // no salgas en verde a medias
      return;
    }
  }

  // backup
  const claudeDir = path.join(CWD, ".claude");
  if (fs.existsSync(claudeDir) && !FLAGS.dryRun) {
    const bk = `.claude.backup.${Date.now()}`;
    fs.cpSync(claudeDir, path.join(CWD, bk), { recursive: true });
    console.log(`\n📦 Backup: ${bk}`);
  }

  // 1) claude-flow PRIMERO (si se opta): es dueño del runtime (settings.json, helpers, .mcp.json).
  //    Nuestra capa se aplica encima con skip-existing y NO lo pisa.
  let flowInstalled = mcpHasFlow();
  if (!FLAGS.noFlow && manifest.claudeFlow?.enabled && !flowInstalled) {
    console.log("\n🐝 Enjambre (claude-flow): instala el runtime real (MCP + helpers + hooks de coordinación).");
    if (await confirm("¿Ejecutar claude-flow init? (descarga ~100 archivos)", FLAGS.all)) {
      if (run(manifest.claudeFlow.initCommand)) flowInstalled = true;
    } else {
      console.log("  → Omitido. La capa base funciona sola (modo coordinación nativa).");
    }
  } else if (flowInstalled) {
    console.log("\n🐝 claude-flow ya presente (.mcp.json). Aplico nuestra capa encima sin pisarlo.");
  }

  // 2) capa base (encima de claude-flow si está). En modo flow se omiten nuestros agentes core
  //    (los cubre claude-flow agents/core/*) para no duplicar nombres de agente.
  console.log("\n📄 Aplicando capa base (shared/.claude)...");
  const manifestPath = path.join(claudeDir, MANIFEST_FILE);
  const prevManifest = readJSON(manifestPath);
  if (FLAGS.update) {
    console.log("  🔄 Modo actualización: se actualizan los archivos del kit que nadie ha tocado.");
    console.log(
      prevManifest
        ? `     Manifiesto de la instalación previa (v${prevManifest.version || "?"}): lo que hayas editado se conserva.`
        : "     Sin manifiesto previo (instalado por una versión antigua): ante la duda se conserva lo tuyo."
    );
  }
  if (!FLAGS.dryRun) fs.mkdirSync(claudeDir, { recursive: true });
  // Solo se omiten los 5 agentes core cuyo NOMBRE colisiona con claude-flow (agents/core/*).
  // El resto de agentes top-level (security-engineer, api-security-audit, ...) se conservan;
  // si claude-flow ya trae uno con el mismo path, applyLayer lo respeta por skip-existing.
  const FLOW_CORE_COLISION = /^agents\/(coder|planner|reviewer|tester|researcher)\.md$/;
  const layer = {
    prev: (prevManifest && prevManifest.files) || {},
    next: {},
    added: 0, updated: 0, same: 0, kept: 0, userOwned: 0, merged: false, conflicts: [],
    skip: (rel) => {
      if (flowInstalled && FLOW_CORE_COLISION.test(rel)) return true;
      // Si claude-flow es dueño del runtime, su settings.json manda: ni se pisa ni se fusiona.
      // (Si aún no existe, sí lo escribimos: el proyecto se quedaría sin hooks ni permisos.)
      if (flowInstalled && rel === "settings.json" && fs.existsSync(path.join(claudeDir, "settings.json"))) return true;
      return false;
    },
  };
  applyLayer(path.join(KIT, "shared", ".claude"), claudeDir, layer);
  reportLayer(layer);
  if (!FLAGS.dryRun) {
    fs.writeFileSync(manifestPath, JSON.stringify({ version: VERSION, files: layer.next }, null, 2) + "\n");
  }

  // 3) Definición del proyecto + CLAUDE.md raíz (añade/actualiza nuestro bloque; respeta el de claude-flow y anexa)
  console.log("\n📝 Definición del proyecto y CLAUDE.md...");
  const hasProject = await scaffoldProject();
  composeClaudeMd(stackId, hasProject);
  ensureGitignore();
  await scaffoldEnvExample();

  // 4) externos (claude-code-templates: agentes + skills)
  if (!FLAGS.noExternal) {
    const { agents, skills } = cctFor(stackId);
    if (agents.length || skills.length) {
      console.log(`\n🧩 Componentes externos curados para ${stackId}:`);
      agents.forEach((a) => console.log(`   agent  ${a}`));
      skills.forEach((s) => console.log(`   skill  ${s}`));
      if (await confirm("¿Instalarlos vía claude-code-templates? (requiere red)", FLAGS.all)) {
        const cli = manifest.cctCli || "npx -y claude-code-templates@1.28.16";
        for (const a of agents) run(`${cli} --agent ${a} --yes`);
        for (const s of skills) run(`${cli} --skill ${s} --yes`);
      } else {
        console.log("  → Omitido. Comandos guardados en components.json para aplicarlos cuando quieras.");
      }
    }

    // 5) deps npm + tools por stack
    const extra = manifest.byStackId?.[stackId];
    if (extra?.npm?.length) {
      console.log(`\n📦 Dependencias npm sugeridas para ${stackId}: ${extra.npm.join(", ")}`);
      if (fs.existsSync(path.join(CWD, "package.json")) && (await confirm("¿Instalarlas ahora?", FLAGS.all))) {
        run(`npm install ${extra.npm.join(" ")}`);
      }
    }
    if (extra?.tools?.includes("react-doctor")) {
      console.log("\n🩺 react-doctor disponible: `npx react-doctor@latest .` para auditar (state/perf/a11y). No se cablea como hook bloqueante.");
    }

    // 5b) tooling de git: husky + lint-staged + commitlint + plantilla de PR (la baseline los exige)
    await maybeSetupHusky();
  }

  // 6) plugins de Claude Code (se añaden DENTRO de Claude Code, no por shell): shared + por-stack
  const [pcat] = stackId.split("/");
  const marketplaces = [];
  const installs = [];
  const seenMk = new Set();
  const pushMk = (id) => { if (id && !seenMk.has(id)) { seenMk.add(id); marketplaces.push(id); } };
  (manifest.shared?.pluginMarketplaces || []).forEach((m) => pushMk(m.id));
  (manifest.shared?.pluginsOptional || []).forEach((p) => installs.push(p.id));
  for (const p of manifest.stacks?.[pcat]?.pluginsOptional || []) {
    if (p.marketplace) pushMk(p.marketplace);
    installs.push(p.id);
  }
  if (marketplaces.length || installs.length) {
    console.log("\n🔌 Plugins de Claude Code (ejecuta DENTRO de Claude Code):");
    marketplaces.forEach((id) => console.log(`   /plugin marketplace add ${id}`));
    installs.forEach((id) => console.log(`   /plugin install ${id}`));
  }

  console.log("\n✅ Listo.");
  console.log("   • Capa base coherente aplicada en .claude/ (agentes, skills, helpers, settings, comandos)");
  console.log("   • CLAUDE.md compuesto (project + base + común + stack) en la raíz");
  console.log("   • Memoria por-proyecto en .claude/memory/ y .gitignore actualizado");
  if (!flowInstalled) console.log("   • Sin claude-flow: coordinación nativa (ejecútalo luego con: " + (manifest.claudeFlow?.initCommand || "claude-flow init") + ")");

  try {
    summarizeProject(stackId);
  } catch (e) {
    console.error(`\n⚠️  No se pudo generar el resumen del proyecto: ${e.message}`); // nunca tumbes una instalación correcta
  }
  closeInput();
}

main().catch((e) => {
  console.error(e);
  closeInput();
  process.exit(1);
});
