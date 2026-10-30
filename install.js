#!/usr/bin/env node
/**
 * install.js — Instalador del Dev Starter Kit (capa coherente + orquestación multiagente nativa).
 *
 * Hace:
 *  1. Detecta el stack (category/stack) o lo pides tú.
 *  2. Backup de .claude/ y copia la capa base (shared/.claude → .claude): agentes, skills, helpers, settings, comandos.
 *  3. Scaffolda CLAUDE.project.md, compone ./CLAUDE.md (project + base) en bloque gestionado y escribe los
 *     overlays del stack como reglas en .claude/rules/kit/ (en monorepo, acotadas a la carpeta de cada stack).
 *  4. Actualiza .gitignore (memoria/runtime/backups/secretos).
 *  5. Avisa de restos de Ruflo (claude-flow): el kit ya no lo integra.
 *  6. (opcional) Instala agentes/skills externos curados (claude-code-templates) y deps npm por stack.
 *  7. Indica los plugins de Claude Code a añadir (shared + por-stack).
 *  8. Imprime un resumen del proyecto (stack, tests, calidad, entrega, git, entorno) y sus huecos.
 *  9. Con --pi, añade la capa para Pi Agent (shared/.pi → .pi) y asegura que .pi/settings.json
 *     cargue las skills de .claude/ (sin copiarlas).
 *
 * Flags:
 *   --stack <cat/stack>[:dir][,…]  fuerza el stack (si no, autodetecta). En monorepo, uno por carpeta:
 *                                  --stack backend/nestjs:apps/api,frontend/nextjs:apps/web
 *   --yes, -y            no interactivo: usa el default de cada confirmación
 *   --all                acepta TODO (externos + deps). Combina con --yes para desatendido total
 *   --no-external        no instala componentes externos (claude-code-templates / npm)
 *   --pi                 añade la capa para Pi Agent; --update la recuerda (manifiesto)
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
  // Retirado junto con Ruflo (claude-flow). Se acepta para no romper scripts, pero no hace nada.
  noFlowLegacy: argv.includes("--no-flow"),
  noExternal: argv.includes("--no-external"),
  pi: argv.includes("--pi"),
  update: argv.includes("--update") || argv.includes("--force"),
  dryRun: argv.includes("--dry-run"),
  help: argv.includes("--help") || argv.includes("-h"),
  // --stack se puede repetir y admite listas: --stack backend/nestjs:apps/api,frontend/nextjs:apps/web
  stackArgs: argv
    .flatMap((a, i) => (a === "--stack" && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1].split(",") : []))
    .map((s) => s.trim())
    .filter(Boolean),
};

if (FLAGS.help) {
  console.log(`
Dev Starter Kit — instalador (.claude)

Uso:  node install.js [opciones]

  --stack <cat/stack>  fuerza el stack (backend/nestjs, frontend/react, mobile/flutter, ...)
                       En monorepo, uno por carpeta: --stack backend/nestjs:apps/api,frontend/nextjs:apps/web
                       (cada overlay se carga solo al trabajar en su carpeta)
  --yes, -y            no interactivo: usa el default de cada confirmación (conservador)
  --all                acepta TODO (externos + deps). Usa "--yes --all" para desatendido total
  --no-external        no instala componentes externos
  --pi                 añade la capa para Pi Agent (.pi/): usa las mismas skills y expande los
                       imports de CLAUDE.md. --update la recuerda.
  --update, --force    actualiza la capa base sin perder nada tuyo: solo reescribe los archivos
                       que siguen igual que como los dejó el kit (según .claude/.kit-manifest.json).
                       Lo que hayas editado se conserva y la versión nueva queda como *.kit-new.
                       settings.json se FUSIONA (tus permisos, hooks y env se mantienen,
                       salvo lo que apunte a Ruflo/claude-flow, que se retira).
                       Memoria y CLAUDE.project.md intactos. Hace backup antes.
  --dry-run            simula sin escribir ni ejecutar
  --help, -h           esta ayuda

Sin TTY (CI, agentes, tuberías) puedes pipear las respuestas una por línea
—  printf 'y\\nn\\n' | node install.js  — y al agotarse se usan los defaults.
Con --yes el stack debe ser detectable o venir en --stack, o sale con error.

Hace: backup de .claude → aplica capa base (agentes/skills/helpers/settings) →
      compone CLAUDE.md + CLAUDE.project.md + reglas del stack → actualiza .gitignore →
      avisa de restos de Ruflo → (opc.) externos → indica plugins de Claude Code.
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
function hasFileIn(dir, ...names) {
  return names.some((n) => fs.existsSync(path.join(dir, n)));
}
const hasFile = (...names) => hasFileIn(CWD, ...names);
function dirHasExt(re, dir = CWD) {
  try {
    return fs.readdirSync(dir).some((f) => re.test(f));
  } catch (_) {
    return false;
  }
}
// Archivos de build de Java/Kotlin. Un proyecto Java NO es necesariamente Spring.
const JAVA_BUILD_FILES = ["pom.xml", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts"];
const javaBuildFiles = (dir = CWD) => JAVA_BUILD_FILES.filter((f) => fs.existsSync(path.join(dir, f)));

// Directorios que nunca contienen el proyecto: artefactos, dependencias y basura de build.
// `packages/` sí se recorre: en un monorepo cada paquete detectado recibe su propio overlay.
const SKIP_SCAN = new Set([
  "node_modules", "bin", "obj", "target", "dist", "build", "out", "vendor",
  "venv", "__pycache__", "coverage", "tmp", "temp", "logs",
]);
// Subdirectorios candidatos, primero los más cercanos a la raíz (búsqueda en anchura).
// Acotado en profundidad y en número: esto corre en el arranque del instalador.
function candidateDirs(maxDepth = 3, maxDirs = 250) {
  const salida = [];
  let nivel = [CWD];
  for (let d = 0; d < maxDepth && salida.length < maxDirs; d++) {
    const siguiente = [];
    for (const dir of nivel) {
      let entradas;
      try {
        entradas = fs.readdirSync(dir, { withFileTypes: true });
      } catch (_) {
        continue;
      }
      for (const e of entradas) {
        if (!e.isDirectory() || e.name.startsWith(".") || SKIP_SCAN.has(e.name)) continue;
        const p = path.join(dir, e.name);
        salida.push(p);
        siguiente.push(p);
        if (salida.length >= maxDirs) break;
      }
    }
    nivel = siguiente;
  }
  return salida;
}

// Spring se declara de muchas formas: starters, BOM, plugin de Gradle, imports del framework.
// Antes solo se miraba /spring-boot/ en pom.xml y /spring/ en build.gradle, así que un Gradle
// con Kotlin DSL o un proyecto Spring sin la palabra exacta se quedaba sin detectar.
const SPRING_SIGNALS = /spring-boot|spring-framework|org\.springframework|io\.spring\.dependency-management/i;
const isSpringProject = (dir = CWD) => javaBuildFiles(dir).some((f) => fileHas(path.join(dir, f), SPRING_SIGNALS));

// Qué se vio cuando la detección falla. Sin esto el usuario solo recibe "no se pudo detectar"
// y tiene que adivinar por qué.
function detectionHint() {
  const java = javaBuildFiles();
  if (java.length) {
    return `Vi ${java.join(", ")}: es un proyecto Java/Kotlin, pero no encontré señales de Spring.\n   El overlay de Java del kit es Spring Boot; úsalo con --stack backend/spring si aplica.\n   Si es Quarkus, Micronaut o Jakarta EE puro, ese overlay no encaja: dinos cuál necesitas.`;
  }
  if (fs.existsSync(path.join(CWD, "go.mod"))) return "Vi go.mod: aún no hay overlay de Go en el kit.";
  if (fs.existsSync(path.join(CWD, "Cargo.toml"))) return "Vi Cargo.toml: aún no hay overlay de Rust en el kit.";
  if (fs.existsSync(path.join(CWD, "package.json"))) return "Vi package.json pero ningún framework reconocido en sus dependencias.";
  return "No vi ningún archivo de proyecto reconocible aquí ni en los subdirectorios cercanos.";
}

// Reglas de detección aplicadas a UN directorio. Parametrizado a propósito: no todos los
// proyectos tienen su manifiesto en la raíz del repo (en .NET lo normal es Proyecto/Proyecto.csproj).
function detectIn(dir) {
  const pkg = readJSON(path.join(dir, "package.json")) || {};
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const req = path.join(dir, "requirements.txt");
  const pyproj = path.join(dir, "pyproject.toml");
  // mobile
  if (fs.existsSync(path.join(dir, "pubspec.yaml"))) return "mobile/flutter";
  if (deps["react-native"] || deps["expo"]) return "mobile/react-native";
  // frontend
  if (fs.existsSync(path.join(dir, "angular.json")) || deps["@angular/core"]) return "frontend/angular";
  if (hasFileIn(dir, "next.config.js", "next.config.mjs", "next.config.ts") || deps["next"]) return "frontend/nextjs"; // antes que react
  // backend específicos
  if (fs.existsSync(path.join(dir, "nest-cli.json")) || deps["@nestjs/core"]) return "backend/nestjs";
  if (fs.existsSync(path.join(dir, "foundry.toml"))) return "blockchain/solidity";
  if (dirHasExt(/\.(csproj|sln)$/, dir)) return "backend/dotnet";
  if (isSpringProject(dir)) return "backend/spring";
  if (fs.existsSync(path.join(dir, "manage.py")) || fileHas(req, /(^|\n)\s*django\b/i) || fileHas(pyproj, /\bdjango\b/i)) return "backend/django";
  if (fs.existsSync(path.join(dir, "composer.json"))) return "backend/php";
  if (fileHas(req, /fastapi/i) || fileHas(pyproj, /fastapi/i)) return "backend/fastapi";
  // frontend genérico (después de next)
  if (deps["react"] && deps["react-dom"]) return "frontend/react";
  // backend JS genérico (Express/Fastify/Koa) — al final, ya descartados los frontends
  if (deps["express"] || deps["fastify"] || deps["koa"]) return "backend/express";
  return null;
}

// La raíz manda. Solo si ahí no hay nada se buscan subdirectorios, porque en .NET, Java y
// muchos repos el manifiesto vive un nivel más abajo (Proyecto/Proyecto.csproj, src/App/...).
// Devuelve TODOS los proyectos encontrados y dónde, para que la decisión sea auditable: uno es
// el caso normal; varios con stacks distintos es un monorepo. Lo que cuelga de un proyecto ya
// detectado no se vuelve a evaluar (su ios/ o su android/ no son otro proyecto).
function detectStacks() {
  const enRaiz = detectIn(CWD);
  if (enRaiz) return [{ id: enRaiz, dir: null }];
  const found = [];
  for (const sub of candidateDirs()) {
    if (found.some((f) => sub.startsWith(path.join(CWD, f.dir) + path.sep))) continue;
    const id = detectIn(sub);
    if (id) found.push({ id, dir: path.relative(CWD, sub).split(path.sep).join("/") });
  }
  return found;
}

// "backend/nestjs" (todo el repo) o "backend/nestjs:apps/api" (solo esa carpeta). Un mismo stack
// en varias carpetas se agrupa en un overlay con varias rutas; `dirs: null` = se carga siempre.
function parseStacks(specs) {
  const byId = new Map();
  for (const spec of specs) {
    const i = spec.indexOf(":");
    const id = (i === -1 ? spec : spec.slice(0, i)).trim();
    const dir = i === -1 ? "" : spec.slice(i + 1).trim().replace(/^\.\/+/, "").replace(/\/+$/, "");
    if (!STACKS[id]) return { error: `Stack inválido: "${id}"` };
    if (!byId.has(id)) byId.set(id, []);
    if (!dir) byId.set(id, null);
    else if (byId.get(id) !== null) byId.get(id).push(dir);
  }
  return { stacks: [...byId].map(([id, dirs]) => ({ id, dirs })) };
}
const describeStacks = (stacks) => stacks.map((s) => (s.dirs ? `${s.id} (${s.dirs.map((d) => `${d}/`).join(", ")})` : s.id)).join(" · ");

// Stacks con los que se instaló el kit la última vez, para que --update no obligue a repetir
// --stack (en un proyecto sin framework detectable, o en un monorepo con todas sus carpetas).
// Desde 3.0.2 van en el manifiesto; las instalaciones 3.0.0/3.0.1 no los guardaban, pero sus
// reglas de .claude/rules/kit/ llevan el stack en el nombre y las carpetas en `paths:`.
function previousStacks(manifestJson) {
  const guardados = (manifestJson && Array.isArray(manifestJson.stacks) ? manifestJson.stacks : []).filter(
    (st) => st && STACKS[st.id] && (st.dirs === null || Array.isArray(st.dirs))
  );
  if (guardados.length) return guardados.map((st) => ({ id: st.id, dirs: st.dirs }));
  const dir = path.join(CWD, ".claude", RULES_DIR);
  let archivos = [];
  try {
    archivos = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch (_) {
    return null;
  }
  const deducidos = [];
  for (const f of archivos) {
    const id = f.replace(/\.md$/, "").replace("-", "/");
    if (!STACKS[id]) continue; // backend.md (común) u otra regla
    const fm = readMaybe(path.join(dir, f)).match(/^---\npaths:\n([\s\S]*?)\n---/);
    const dirs = fm
      ? [...fm[1].matchAll(/^\s*-\s*"(.+)\/\*\*"\s*$/gm)].map((m) => m[1].replace(/\\(.)/g, "$1"))
      : null;
    deducidos.push({ id, dirs: dirs && dirs.length ? dirs : null });
  }
  return deducidos.length ? deducidos : null;
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
      const text = JSON.stringify(mergeSettings(s, d, ctx.retiredSettings), null, 2) + "\n";
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

    applyFile(rel, fs.readFileSync(s), d, ctx);
  }
}

// Las reglas de applyLayer para UN archivo, venga de shared/.claude o lo genere el instalador
// (los overlays del stack): así ambos se actualizan igual y nunca se pisa una edición tuya.
function applyFile(rel, srcBuf, d, ctx) {
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  const shown = path.relative(CWD, d);
  ctx.next[rel] = hash(srcBuf);
  if (!fs.existsSync(d)) {
    if (!FLAGS.dryRun) {
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.writeFileSync(d, srcBuf);
    }
    console.log(`  ${dry}➕ ${shown}`);
    ctx.added++;
    return;
  }
  const destHash = hash(fs.readFileSync(d));
  if (destHash === ctx.next[rel]) {
    ctx.same++;
    return;
  }
  if (!FLAGS.update) {
    ctx.kept++;
    return;
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
    console.log(`  ${dry}⚠️  ${shown} — lo tuyo se conserva, la versión nueva queda en ${path.basename(d)}.kit-new`);
    ctx.conflicts.push(shown);
  }
}

// ---------- overlays del stack como reglas de Claude Code ----------
// Antes iban dentro del bloque gestionado de CLAUDE.md, que se regenera entero en cada
// ejecución: cualquier edición se perdía, y en un monorepo solo cabía UN stack para todo el
// repo. Ahora son archivos de .claude/rules/kit/ con manifiesto como el resto de la capa:
//  - sin `paths` se cargan siempre (lo mismo que antes, proyecto de un solo stack);
//  - con `paths` (monorepo) Claude Code los carga solo al trabajar en esa carpeta, así cada
//    paquete recibe las reglas de SU stack y no las de los demás.
const RULES_DIR = "rules/kit";
const globDir = (d) => `${d.replace(/[[\]{}*?]/g, "\\$&").replace(/"/g, '\\"')}/**`;
function stackRules(stacks) {
  const files = new Map();
  const add = (rel, source, label, dirs) => {
    const body = readMaybe(source);
    if (!body) return; // p. ej. blockchain no tiene _common
    const f = files.get(rel) || { label, body, always: false, paths: new Set() };
    if (dirs === null) f.always = true;
    else dirs.forEach((d) => f.paths.add(globDir(d)));
    files.set(rel, f);
  };
  for (const { id, dirs } of stacks) {
    const [cat, st] = id.split("/");
    add(`${RULES_DIR}/${cat}.md`, path.join(KIT, "stacks", cat, "_common", ".claude", "CLAUDE.md"), `${cat} (común)`, dirs);
    add(`${RULES_DIR}/${cat}-${st}.md`, path.join(KIT, "stacks", cat, st, ".claude", "CLAUDE.md"), id, dirs);
  }
  return [...files].map(([rel, f]) => {
    const fm = f.always ? "" : `---\npaths:\n${[...f.paths].map((p) => `  - "${p}"`).join("\n")}\n---\n`;
    const aviso = `<!-- dev-starter-kit · overlay ${f.label}. Lo genera el instalador; si lo editas, --update respeta tus cambios. -->\n`;
    return { rel, buf: Buffer.from(`${fm}${aviso}${f.body}\n`) };
  });
}

// Fusiona el settings.json del kit con el tuyo sin perder nada:
//  - hooks: el kit solo reemplaza SUS entradas (las que apuntan a sus helpers); las tuyas siguen.
//  - permisos: unión sin duplicados.
//  - env: tus valores ganan.  - statusLine: si apunta a otra cosa, se respeta.
//  - cualquier otra clave que hayas añadido se conserva tal cual.
// Única excepción: lo que apunta a Ruflo (claude-flow) se retira. El kit lo instalaba (permisos,
// env, y el `claude-flow init` que traía sus propios hooks) y ya no lo integra; dejarlo haría que
// cada sesión siguiera llamando a un runtime que nadie mantiene. Lo retirado se informa.
const isKitHook = (g) =>
  Array.isArray(g && g.hooks) && g.hooks.length > 0 && g.hooks.every((h) => /hook-handler\.cjs|auto-memory-hook\.mjs|loop\.cjs/.test((h && h.command) || ""));
const RUFLO = /claude[-_]?flow|ruflo|ruv-swarm|flow-nexus/i;
// Permisos que versiones anteriores del kit escribían y que ya no se usan. La unión de permisos
// los arrastraría para siempre. Read(./.env.*) bloqueaba también .env.example: lo sustituyen
// denies explícitos y el hook pre-read.
const RETIRED_PERMISSIONS = new Set(["Read(./.env.*)", "Bash(npx react-doctor*)"]);
const isRuflo = (v) => RUFLO.test(typeof v === "string" ? v : JSON.stringify(v));

function mergeSettings(kitPath, destPath, retired = []) {
  const kit = readJSON(kitPath) || {};
  const cur = readJSON(destPath) || {};
  const out = { ...cur };
  if (kit.$schema) out.$schema = kit.$schema;
  for (const k of Object.keys(out)) {
    if (isRuflo(k)) {
      delete out[k];
      retired.push(`clave "${k}"`);
    } else if (Array.isArray(out[k]) && !["hooks", "permissions"].includes(k)) {
      // p. ej. enabledMcpjsonServers: ["claude-flow", "ruv-swarm", "github"]
      const limpio = out[k].filter((v) => !isRuflo(v));
      if (limpio.length !== out[k].length) {
        retired.push(`${k}: ${out[k].filter(isRuflo).join(", ")}`);
        out[k] = limpio;
      }
    }
  }

  const hooks = { ...(cur.hooks || {}) };
  for (const ev of new Set([...Object.keys(kit.hooks || {}), ...Object.keys(cur.hooks || {})])) {
    const tuyos = (cur.hooks?.[ev] || []).filter((g) => {
      if (isKitHook(g)) return false;
      if (isRuflo(g)) {
        retired.push(`hook ${ev}`);
        return false;
      }
      return true;
    });
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
    if (Array.isArray(a) || Array.isArray(b)) {
      perms[k] = [...new Set([...(a || []), ...(b || [])])].filter((p) => {
        if (RETIRED_PERMISSIONS.has(p)) {
          retired.push(`permiso ${p} (el kit ya no lo usa)`);
          return false;
        }
        if (!isRuflo(p)) return true;
        retired.push(`permiso ${p}`);
        return false;
      });
    } else perms[k] = b !== undefined ? b : a;
  }
  out.permissions = perms;

  const env = { ...(kit.env || {}), ...(cur.env || {}) };
  for (const k of Object.keys(env)) {
    if (isRuflo(k)) {
      delete env[k];
      retired.push(`env ${k}`);
    }
  }
  if (Object.keys(env).length) out.env = env;
  else delete out.env;
  const propia = cur.statusLine && !/statusline\.cjs/.test(JSON.stringify(cur.statusLine));
  if (!propia && kit.statusLine) out.statusLine = kit.statusLine;
  return out;
}

// Archivos que el kit instaló y ya no distribuye (p. ej. los helpers de la memoria propia, que
// sustituye la memoria nativa de Claude Code). Con --update se borran SOLO si siguen idénticos a
// como los dejó el kit; si los editaste, se conservan y se avisa. Sin --update no se tocan, pero
// se siguen recordando en el manifiesto para poder retirarlos en la próxima actualización.
// Las instalaciones anteriores a 2.1 no tienen manifiesto: sus helpers retirados solo se avisan.
const RETIRED_WITHOUT_MANIFEST = [
  "helpers/memory.cjs", "helpers/session.cjs", "helpers/auto-memory-hook.mjs", "helpers/router.cjs", "helpers/intelligence.cjs",
];
function retireFiles(ctx, claudeDir) {
  const remembered = {};
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  const candidates = { ...ctx.prev };
  for (const rel of RETIRED_WITHOUT_MANIFEST) if (!(rel in candidates)) candidates[rel] = null;
  for (const [rel, h] of Object.entries(candidates)) {
    if (ctx.next[rel]) continue;
    const p = path.join(claudeDir, rel);
    if (!fs.existsSync(p)) continue;
    const shown = path.relative(CWD, p);
    if (FLAGS.update && h && hash(fs.readFileSync(p)) === h) {
      if (!FLAGS.dryRun) fs.rmSync(p);
      console.log(`  ${dry}🗑️  ${shown} (el kit ya no lo usa)`);
      ctx.retired++;
      continue;
    }
    if (h) remembered[rel] = h;
    if (FLAGS.update) {
      console.log(`  ⚠️  ${shown} ya no es parte del kit, pero ${h ? "lo editaste" : "no hay manifiesto para saber si lo editaste"}: se conserva. Bórralo si no lo usas.`);
      ctx.retiredKept++;
    }
  }
  return remembered;
}

function reportLayer(ctx) {
  const l = [];
  if (ctx.added) l.push(`${ctx.added} nuevos`);
  if (ctx.updated) l.push(`${ctx.updated} actualizados`);
  if (ctx.retired) l.push(`${ctx.retired} retirados`);
  if (ctx.same) l.push(`${ctx.same} ya al día`);
  if (ctx.kept) l.push(`${ctx.kept} conservados (usa --update para actualizarlos)`);
  if (ctx.userOwned) l.push(`${ctx.userOwned} tuyos respetados (los editaste y el kit no los cambió)`);
  if (ctx.merged) l.push("settings.json fusionado");
  if (l.length) console.log(`  📋 ${l.join(" · ")}`);
  if (ctx.retiredSettings.length) {
    const dry = FLAGS.dryRun ? "(dry-run) " : "";
    console.log(`\n  ${dry}🧹 Retirado de settings.json (Ruflo o permisos que el kit ya no usa): ${[...new Set(ctx.retiredSettings)].join(" · ")}`);
    if (!FLAGS.dryRun) console.log("     Si lo necesitabas, está en el backup .claude.backup.* de esta ejecución.");
  }
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

// Ruflo (antes claude-flow) dejaba runtime, servidores MCP y decenas de archivos propios en el
// proyecto. El kit ya no lo integra, pero no borra nada que no instaló él mismo: lo encuentra,
// lo enumera y dice cómo quitarlo. Solo lectura. `kitFiles` son las rutas (relativas a .claude/)
// que gestiona el kit: esas nunca cuentan como restos.
function rufloLeftovers(kitFiles = {}) {
  const found = [];
  const mcp = readJSON(path.join(CWD, ".mcp.json"));
  for (const [name, def] of Object.entries((mcp && mcp.mcpServers) || {})) {
    if (isRuflo(name) || isRuflo(def)) found.push(`.mcp.json: servidor "${name}" → quítalo de mcpServers`);
  }
  for (const d of [".claude-flow", ".swarm", ".hive-mind"]) {
    if (fs.existsSync(path.join(CWD, d))) found.push(`${d}/ → rm -rf ${d}`);
  }
  if (fileHas(path.join(CWD, ".claude", "settings.json"), RUFLO)) {
    found.push(
      FLAGS.update && !FLAGS.dryRun
        ? ".claude/settings.json: sigue mencionando Ruflo en algo que el kit no gestiona → revísalo a mano"
        : ".claude/settings.json: hooks/permisos de Ruflo → se retiran con --update"
    );
  }
  const enClaude = [];
  const queue = [path.join(CWD, ".claude")];
  for (let visited = 0; queue.length && visited < 2000; visited++) {
    const dir = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      continue;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        // La memoria (de agente o la antigua) es contenido, no configuración: no cuenta como resto.
        if (!["memory", "agent-memory", "agent-memory-local"].includes(e.name)) queue.push(p);
      } else if (
        e.name !== "settings.json" &&
        !kitFiles[path.relative(path.join(CWD, ".claude"), p).split(path.sep).join("/")] &&
        /\.(md|json|cjs|mjs|js|sh)$/.test(e.name) &&
        fileHas(p, RUFLO)
      ) {
        enClaude.push(path.relative(CWD, p));
      }
    }
  }
  if (enClaude.length) {
    found.push(`.claude/: ${plural(enClaude.length, "archivo menciona", "archivos mencionan")} Ruflo/claude-flow (p. ej. ${enClaude.slice(0, 3).join(", ")})`);
  }
  const root = readMaybe(path.join(CWD, "CLAUDE.md"));
  const fuera = root.replace(new RegExp(`${esc(MB)}[\\s\\S]*?${esc(ME)}`), "");
  if (RUFLO.test(fuera)) found.push("CLAUDE.md: hay instrucciones de Ruflo fuera del bloque del kit → bórralas a mano");
  return found;
}

// La memoria de agente con scope `project` (.claude/agent-memory/) se versiona a propósito: es
// conocimiento del equipo. La `local` y CLAUDE.local.md son personales. .claude/memory/ es de la
// memoria propia que tuvo el kit hasta la 2.x: se sigue ignorando para no versionar restos.
// Ciclo en curso (skill loop-task): .claude/loop/ es el contrato y .loop/ el progreso. De trabajo, no de equipo.
const GITIGNORE = [".claude/memory/", ".claude/agent-memory-local/", ".claude/loop/", ".loop/", "CLAUDE.local.md", ".claude.backup.*", ".env", ".env.*"];
// Los archivos de ejemplo de env van versionados (la baseline los exige), pero ".env.*" los
// captura. Git aplica la última regla que casa, así que las negaciones van SIEMPRE después.
const GITIGNORE_KEEP = ["!.env.example", "!.env.sample", "!.env.template"];

// ---------- .pi/settings.json (con --pi) ----------
// Es de la persona (tema, modelo, paquetes…): el kit solo se asegura de que Pi cargue las skills
// de .claude/ y el comando /status (de .claude/commands/kit/status.md), sin copiarlos. /swarm no
// se carga: depende de los subagentes de Claude Code. Las rutas de ese archivo son relativas a .pi/.
const PI_RESOURCES = { skills: ["../.claude/skills"], prompts: ["../.claude/commands/kit/status.md"] };
function mergePiSettings() {
  const p = path.join(CWD, ".pi", "settings.json");
  const exists = fs.existsSync(p);
  const cur = exists ? readJSON(p) : {};
  const keys = Object.keys(PI_RESOURCES);
  if (!cur || typeof cur !== "object" || Array.isArray(cur) || keys.some((k) => cur[k] !== undefined && !Array.isArray(cur[k]))) {
    console.log(`  ⚠️  .pi/settings.json no tiene el formato esperado: no se toca. Agrega a mano ${keys.map((k) => `"${k}": ${JSON.stringify(PI_RESOURCES[k])}`).join(" y ")}.`);
    return;
  }
  const next = { ...cur };
  for (const k of keys) next[k] = [...(cur[k] || []), ...PI_RESOURCES[k].filter((r) => !(cur[k] || []).includes(r))];
  if (JSON.stringify(next) === JSON.stringify(cur)) return;
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  if (!FLAGS.dryRun) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(next, null, 2) + "\n");
  }
  console.log(`  ${dry}${exists ? "🔀" : "➕"} .pi/settings.json (skills y /status de .claude/)`);
}

// Asegura que .gitignore cubra memoria/runtime/backups/secretos (idempotente).
function ensureGitignore(withPi = false) {
  const gi = path.join(CWD, ".gitignore");
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
  // `npm init` no crea .gitignore y el propio kit instala devDeps: sin esto, el primer
  // `git add .` mete node_modules/ al repo.
  const node = fs.existsSync(path.join(CWD, "package.json")) && !have.has("node_modules") && !have.has("/node_modules") ? ["node_modules/"] : [];
  const add = [...node, ...GITIGNORE, ...(withPi ? [".pi.backup.*"] : [])].filter((n) => !have.has(n));
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

function composeClaudeMd(hasProject) {
  const imports = [];
  if (hasProject) imports.push("@CLAUDE.project.md");
  imports.push("@.claude/CLAUDE.base.md");
  imports.push("<!-- Reglas del stack: .claude/rules/kit/ (Claude Code las carga solo; en monorepo, por carpeta). -->");
  const block = `${MB}\n${imports.join("\n")}\n${ME}\n`;
  const root = path.join(CWD, "CLAUDE.md");
  const dry = FLAGS.dryRun ? "(dry-run) " : "";
  if (!fs.existsSync(root)) {
    if (!FLAGS.dryRun) fs.writeFileSync(root, block);
    console.log(`  ${dry}➕ ./CLAUDE.md (proyecto + baseline; el stack va en .claude/rules/kit/)`);
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
function cctFor(stacks) {
  const agents = [];
  const skills = [];
  for (const a of manifest.shared?.agents || []) agents.push(a.id);
  for (const s of manifest.shared?.skills || []) skills.push(s.id);
  for (const cat of new Set(stacks.map((st) => st.id.split("/")[0]))) {
    const sc = manifest.stacks?.[cat] || {};
    for (const a of sc.agents || []) if (a.rec === "integrar") agents.push(a.id);
    for (const s of sc.skills || []) if (s.rec === "integrar") skills.push(s.id);
  }
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

// Configuración de lint-staged a partir de lo que el proyecto YA tiene (prettier, eslint,
// tsconfig). Sin ninguna tarea devuelve null: un pre-commit con lint-staged sin configuración
// falla en CADA commit ("could not find any valid configuration"), que es peor que no tenerlo.
// Una sola entrada por tipo de archivo para que los comandos corran en orden y no a la vez.
function lintStagedConfig(deps) {
  const code = [];
  if (deps.prettier) code.push("`prettier --write ${q(files)}`");
  if (deps.eslint) code.push("`eslint --fix ${q(files)}`");
  // tsc revisa el proyecto entero, no archivo por archivo: un error de tipos bloquea el commit.
  if (fs.existsSync(path.join(CWD, "tsconfig.json"))) code.push('"tsc --noEmit"');
  const usesFiles = Boolean(deps.prettier || deps.eslint);
  const entries = [];
  if (code.length === 1 && !usesFiles) entries.push(`  "*.{js,jsx,mjs,cjs,ts,tsx}": () => ${code[0]},`);
  else if (code.length) entries.push(`  "*.{js,jsx,mjs,cjs,ts,tsx}": (files) => [${code.join(", ")}],`);
  if (deps.prettier) entries.push('  "*.{json,md,css,scss,yml,yaml}": "prettier --write",');
  if (!entries.length) return null;
  return [
    "// lint-staged: lo que corre sobre los archivos en stage antes de cada commit (lo generó dev-starter-kit).",
    ...(usesFiles ? ["const q = (files) => files.map((f) => JSON.stringify(f)).join(\" \");", ""] : []),
    "export default {",
    ...entries,
    "};",
    "",
  ].join("\n");
}
function hasLintStagedConfig(pkg) {
  if (pkg["lint-staged"]) return true;
  try {
    return fs.readdirSync(CWD).some((f) => /^(\.lintstagedrc.*|lint-staged\.config\..+)$/.test(f));
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
  const lintStaged = hasLintStagedConfig(pkg) ? "existente" : lintStagedConfig(deps);
  console.log(
    lintStaged === "existente"
      ? "  pre-commit: lint-staged con la configuración que ya tiene el proyecto."
      : lintStaged
        ? `  pre-commit: lint-staged → ${[deps.prettier && "prettier", deps.eslint && "eslint", fs.existsSync(path.join(CWD, "tsconfig.json")) && "tsc --noEmit"].filter(Boolean).join(" + ")}.`
        : "  pre-commit: nada que revisar todavía (sin prettier, eslint ni tsconfig). Solo se valida el mensaje del commit; relanza cuando tengas linter."
  );
  if (!(await confirm("¿Configurarlos ahora? (instala devDeps)", FLAGS.all))) {
    console.log("  → Omitido. Hazlo luego o la regla aplica solo 'si el repo los tiene'.");
    return;
  }
  // Baseline §6.1 aplicada al propio instalador: versiones exactas (-E) y solo versiones con al
  // menos 7 días publicadas (--before), que es el plazo en que se suelen retirar los paquetes
  // comprometidos.
  const cooldown = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const paquetes = ["husky", ...(lintStaged ? ["lint-staged"] : []), "@commitlint/cli", "@commitlint/config-conventional"];
  if (run(`npm install -D -E --before=${cooldown} ${paquetes.join(" ")}`) && run("npx --no-install husky init")) {
    if (!FLAGS.dryRun) {
      try {
        const creados = ["commitlint.config.cjs", ".husky/commit-msg"];
        fs.writeFileSync(path.join(CWD, "commitlint.config.cjs"), 'module.exports = { extends: ["@commitlint/config-conventional"] };\n');
        fs.writeFileSync(path.join(CWD, ".husky", "commit-msg"), 'npx --no-install commitlint --edit "$1"\n');
        if (lintStaged) {
          fs.writeFileSync(path.join(CWD, ".husky", "pre-commit"), "npx --no-install lint-staged\n");
          creados.push(".husky/pre-commit");
          if (lintStaged !== "existente") {
            fs.writeFileSync(path.join(CWD, ".lintstagedrc.mjs"), lintStaged);
            creados.push(".lintstagedrc.mjs");
          }
        } else {
          // husky init deja un pre-commit con `npm test`, y el test por defecto de `npm init` sale
          // con error: bloquearía todos los commits de un proyecto recién creado.
          fs.rmSync(path.join(CWD, ".husky", "pre-commit"), { force: true });
        }
        const prDir = path.join(CWD, ".github");
        fs.mkdirSync(prDir, { recursive: true });
        fs.writeFileSync(path.join(prDir, "pull_request_template.md"), "## Summary\n\n## Test plan\n- [ ] \n");
        creados.push(".github/pull_request_template.md");
        console.log(`  ➕ ${creados.join(", ")}`);
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
// `tsc --init` (TypeScript 5.9+) genera module nodenext + verbatimModuleSyntax, y `npm init`
// deja el paquete en CommonJS: la combinación rechaza todo import/export (TS1286/TS1295). Le
// pasa a cualquier proyecto TypeScript nuevo, así que se avisa en el resumen.
function tsModuleMismatch(pkg) {
  const ts = readMaybe(path.join(CWD, "tsconfig.json")).replace(/^\s*\/\/.*$/gm, "");
  if (!/"verbatimModuleSyntax"\s*:\s*true/.test(ts)) return false;
  if (!/"module"\s*:\s*"node(next|16|18|20)"/i.test(ts)) return false;
  return pkg.type !== "module";
}
function summarizeProject(stacks) {
  const stackId = stacks[0].id;
  const monorepo = stacks.length > 1;
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
  add("Stack", [describeStacks(stacks), ...lang].join(" · "));
  if (tsModuleMismatch(pkg)) {
    add("Módulos", '⚠️ tsconfig con verbatimModuleSyntax y package.json en CommonJS: ningún import/export compila. Pon "type": "module" en package.json');
  }

  // En monorepo el framework vive en cada paquete, no en el package.json de la raíz.
  const fw = !monorepo && FRAMEWORK_DEP[stackId] && dep(FRAMEWORK_DEP[stackId]);
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

  const exts = [...new Set(stacks.flatMap((st) => CODE_EXT[st.id] || []))];
  const code = walkCode(exts.length ? exts : [".ts", ".tsx", ".js", ".py", ".php", ".java", ".cs", ".dart", ".sol"]);
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
  console.log("   /project-context rellena CLAUDE.project.md con esto y te pregunta lo que no se puede inferir: dominio, decisiones y límites.");
}

// ---------- main ----------
async function main() {
  const VERSION = (readJSON(path.join(KIT, "package.json")) || {}).version || "?";
  console.log("\n╔════════════════════════════════════════════╗");
  console.log(`║   Dev Starter Kit v${VERSION} — instalador      `.slice(0, 45) + "║");
  console.log("╚════════════════════════════════════════════╝");

  const claudeDir = path.join(CWD, ".claude");
  const manifestPath = path.join(claudeDir, MANIFEST_FILE);
  const prevManifest = readJSON(manifestPath);
  const anteriores = FLAGS.stackArgs.length ? null : previousStacks(prevManifest);

  let stacks = null;
  if (anteriores) {
    stacks = anteriores;
    console.log(`\n✅ Stack de la instalación anterior: ${describeStacks(stacks)}`);
    console.log("   Para cambiarlo: --stack <category/stack>[:carpeta][,…]");
    if (!(await confirm("¿Es correcto?", true))) stacks = null;
  } else if (FLAGS.stackArgs.length) {
    const r = parseStacks(FLAGS.stackArgs);
    if (r.error) console.log(`⚠️  ${r.error}.`);
    else {
      stacks = r.stacks;
      console.log(`\n✅ Stack indicado: ${describeStacks(stacks)}`);
    }
  } else {
    const found = detectStacks();
    const ids = [...new Set(found.map((f) => f.id))];
    if (ids.length === 1) {
      // Un solo stack (aunque esté en una o varias subcarpetas): su overlay se carga siempre.
      const donde = found[0].dir ? ` (por ${found.map((f) => `${f.dir}/`).join(", ")}, no por la raíz)` : "";
      console.log(`\n✅ Stack detectado: ${ids[0]}${donde}`);
      if (found[0].dir) console.log(`   El kit se instala aquí, en ${path.basename(CWD)}/, para que el CLAUDE.md cubra todo el repo.`);
      stacks = [{ id: ids[0], dirs: null }];
    } else if (ids.length > 1) {
      stacks = ids.map((id) => ({ id, dirs: found.filter((f) => f.id === id).map((f) => f.dir) }));
      console.log(`\n✅ Monorepo: ${ids.length} stacks detectados, cada uno con sus reglas solo en su carpeta:`);
      for (const st of stacks) console.log(`   ${st.id.padEnd(22)} → ${st.dirs.map((d) => `${d}/`).join(", ")}`);
    }
    if (stacks && !(await confirm("¿Es correcto?", true))) stacks = null;
  }
  if (!stacks) {
    if (!FLAGS.stackArgs.length && !anteriores) console.log(`\n🔍 ${detectionHint()}`);
    console.log("\nStacks disponibles:\n  " + Object.keys(STACKS).join("\n  "));
    const answer = await ask("\nElige stack (category/stack; en monorepo, category/stack:carpeta separados por coma): ");
    const r = parseStacks((answer || "").split(",").map((x) => x.trim()).filter(Boolean));
    if (answer === null || r.error || !r.stacks.length) {
      console.error(
        answer === null
          ? "\n❌ No se pudo detectar el stack y no hay entrada interactiva disponible.\n   Relanza indicándolo: node install.js --stack <category/stack>[:carpeta][,…]"
          : `\n❌ ${r.error || "No elegiste ningún stack"}`
      );
      closeInput();
      process.exitCode = 1; // no salgas en verde a medias
      return;
    }
    stacks = r.stacks;
  }
  // --pi se recuerda en el manifiesto: un --update posterior no la pierde.
  const withPi = FLAGS.pi || Boolean(prevManifest && prevManifest.pi);
  const piDir = path.join(CWD, ".pi");

  // backup
  const stamp = Date.now();
  for (const dir of withPi ? [claudeDir, piDir] : [claudeDir]) {
    if (fs.existsSync(dir) && !FLAGS.dryRun) {
      const bk = `${path.basename(dir)}.backup.${stamp}`;
      fs.cpSync(dir, path.join(CWD, bk), { recursive: true });
      console.log(`\n📦 Backup: ${bk}`);
    }
  }

  if (FLAGS.noFlowLegacy) {
    console.log("\nℹ️  --no-flow ya no hace nada: el kit dejó de integrar Ruflo (claude-flow). Puedes quitarlo de tus scripts.");
  }

  // 1) capa base
  console.log("\n📄 Aplicando capa base (shared/.claude)...");
  if (FLAGS.update) {
    console.log("  🔄 Modo actualización: se actualizan los archivos del kit que nadie ha tocado.");
    console.log(
      prevManifest
        ? `     Manifiesto de la instalación previa (v${prevManifest.version || "?"}): lo que hayas editado se conserva.`
        : "     Sin manifiesto previo (instalado por una versión antigua): ante la duda se conserva lo tuyo."
    );
  }
  if (!FLAGS.dryRun) fs.mkdirSync(claudeDir, { recursive: true });
  const layer = {
    prev: (prevManifest && prevManifest.files) || {},
    next: {},
    added: 0, updated: 0, same: 0, kept: 0, userOwned: 0, merged: false, conflicts: [], retiredSettings: [],
    retired: 0, retiredKept: 0,
  };
  applyLayer(path.join(KIT, "shared", ".claude"), claudeDir, layer);
  // Reglas del stack: mismo manifiesto, así un cambio de stack retira la regla vieja si está intacta.
  for (const r of stackRules(stacks)) applyFile(r.rel, r.buf, path.join(claudeDir, r.rel), layer);
  const remembered = retireFiles(layer, claudeDir);
  reportLayer(layer);

  // 1b) capa de Pi Agent: mismas reglas de manifiesto, en su propia sección.
  const piLayer = {
    prev: (prevManifest && prevManifest.pi && prevManifest.pi.files) || {},
    next: {},
    added: 0, updated: 0, same: 0, kept: 0, userOwned: 0, merged: false, conflicts: [], retiredSettings: [],
    retired: 0, retiredKept: 0,
  };
  if (withPi) {
    console.log("\n🧩 Capa de Pi Agent (shared/.pi)...");
    applyLayer(path.join(KIT, "shared", ".pi"), piDir, piLayer);
    mergePiSettings();
    reportLayer(piLayer);
  }
  if (!FLAGS.dryRun) {
    const m = { version: VERSION, stacks, files: { ...remembered, ...layer.next }, ...(withPi ? { pi: { files: piLayer.next } } : {}) };
    fs.writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n");
  }

  // 2) Definición del proyecto + CLAUDE.md raíz (añade/actualiza nuestro bloque; respeta lo demás)
  console.log("\n📝 Definición del proyecto y CLAUDE.md...");
  const hasProject = await scaffoldProject();
  composeClaudeMd(hasProject);
  ensureGitignore(withPi);
  await scaffoldEnvExample();

  // 3) restos de Ruflo (solo lectura)
  const ruflo = rufloLeftovers(layer.next);
  if (ruflo.length) {
    console.log("\n🧹 Restos de Ruflo (claude-flow) en este proyecto. El kit ya no lo integra:");
    ruflo.forEach((r) => console.log(`   • ${r}`));
    console.log("   No borro nada que no instalé yo: revísalo y elimínalo cuando confirmes que no lo usas.");
  }

  // 4) externos (claude-code-templates: agentes + skills)
  if (!FLAGS.noExternal) {
    const { agents, skills } = cctFor(stacks);
    if (agents.length || skills.length) {
      console.log(`\n🧩 Componentes externos curados para ${stacks.map((x) => x.id).join(", ")}:`);
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

    // 5) deps npm + tools por stack. En monorepo no se instalan en la raíz: van en el paquete,
    //    con el gestor de workspaces del repo, y eso lo decide la persona.
    for (const st of stacks) {
      const npmDeps = manifest.byStackId?.[st.id]?.npm || [];
      if (!npmDeps.length) continue;
      console.log(`\n📦 Dependencias npm sugeridas para ${st.id}: ${npmDeps.join(", ")}`);
      if (st.dirs) {
        console.log(`   Instálalas dentro de ${st.dirs.map((d) => `${d}/`).join(", ")} con el gestor de workspaces del repo.`);
      } else if (fs.existsSync(path.join(CWD, "package.json")) && (await confirm("¿Instalarlas ahora?", FLAGS.all))) {
        run(`npm install ${npmDeps.join(" ")}`);
      }
    }

    // 5b) tooling de git: husky + lint-staged + commitlint + plantilla de PR (la baseline los exige)
    await maybeSetupHusky();
  }

  // 6) plugins de Claude Code (se añaden DENTRO de Claude Code, no por shell): shared + por-stack
  const marketplaces = [];
  const installs = [];
  const seenMk = new Set();
  const pushMk = (id) => { if (id && !seenMk.has(id)) { seenMk.add(id); marketplaces.push(id); } };
  (manifest.shared?.pluginMarketplaces || []).forEach((m) => pushMk(m.id));
  (manifest.shared?.pluginsOptional || []).forEach((p) => installs.push(p));
  for (const cat of new Set(stacks.map((st) => st.id.split("/")[0]))) {
    for (const p of manifest.stacks?.[cat]?.pluginsOptional || []) {
      if (p.marketplace) pushMk(p.marketplace);
      if (!installs.some((x) => x.id === p.id)) installs.push(p);
    }
  }
  // Code intelligence (LSP) de cada stack: el plugin es solo el adaptador; el binario del
  // language server lo instala la persona (el kit no instala nada en global).
  const lsps = new Map();
  for (const st of stacks) {
    const l = manifest.byStackId?.[st.id]?.lsp;
    if (l) lsps.set(l.plugin, { ...l, stacks: [...(lsps.get(l.plugin)?.stacks || []), st.id] });
  }
  if (marketplaces.length || installs.length || lsps.size) {
    console.log("\n🔌 Plugins de Claude Code (ejecuta DENTRO de Claude Code):");
    marketplaces.forEach((id) => console.log(`   /plugin marketplace add ${id}`));
    // `short` resume la condición que hay que conocer antes de instalarlo (costo, datos que envía…).
    installs.forEach((p) => console.log(`   /plugin install ${p.id}${p.short ? `   # ${p.short}` : ""}`));
    for (const l of lsps.values()) {
      console.log(`\n🧠 Code intelligence para ${l.stacks.join(", ")}: go-to-definition, referencias y errores de tipos en vivo.`);
      console.log(`   /plugin install ${l.plugin}`);
      console.log(`   Requiere el language server instalado por ti: ${l.binary}`);
    }
  }

  console.log("\n✅ Listo.");
  console.log("   • Capa base coherente aplicada en .claude/ (agentes, skills, helpers, settings, comandos)");
  console.log(`   • CLAUDE.md compuesto (proyecto + baseline) y reglas del stack en .claude/rules/kit/: ${describeStacks(stacks)}`);
  console.log("   • Memoria: la nativa de Claude Code + la de agente en .claude/agent-memory/ (versionada); .gitignore actualizado");
  console.log("   • Siguiente paso: abre Claude Code y corre /project-context para rellenar CLAUDE.project.md");
  if (withPi) {
    console.log("\n🧩 Pi Agent (capa .pi/):");
    console.log("   • Abre pi en el proyecto y acepta su confianza: sin ella Pi no carga .pi/ (ni las skills, ni los");
    console.log('     imports de CLAUDE.md, ni las reglas). Con la capa activa verás "🧰 dev-kit" abajo.');
    console.log("   • Las skills se invocan como /skill:<nombre> (/skill:project-context, /skill:tdd…) y el estado del kit con /status.");
    console.log("   • Guardrails: antes de cada herramienta se aplican las reglas del kit y las deny/ask de .claude/settings.json;");
    console.log("     lo que pide confirmación se bloquea si no hay interfaz (pi -p). No es aislamiento: para eso, un contenedor o una VM.");
    console.log("   • En Pi no hay subagentes: /swarm y los agentes de .claude/agents/ son solo de Claude Code. En /loop-task,");
    console.log("     el cierre lo apruebas tú (sin interfaz: node .claude/helpers/loop.cjs approve | reject).");
    console.log("   • Pi envía telemetría anónima de instalación por defecto: PI_TELEMETRY=0 la apaga.");
    console.log("   • Instala ripgrep y fd con el gestor de paquetes de tu sistema: si faltan, Pi descarga la última versión sin fijarla.");
  }

  try {
    summarizeProject(stacks);
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
