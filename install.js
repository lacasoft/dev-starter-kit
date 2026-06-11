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
  --update, --force    actualiza la capa base: SOBRESCRIBE agentes/skills/helpers/comandos
                       del kit con la última versión (conserva memoria y CLAUDE.project.md;
                       respeta settings.json de claude-flow si está). Hace backup antes.
  --dry-run            simula sin escribir ni ejecutar
  --help, -h           esta ayuda

Hace: backup de .claude → aplica capa base (agentes/skills/helpers/settings) →
      compone CLAUDE.md (base+común+stack) + CLAUDE.project.md → actualiza .gitignore →
      (opc.) claude-flow init → (opc.) externos → indica plugins de Claude Code.
`);
  process.exit(0);
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));
async function confirm(q, def = true) {
  if (FLAGS.yes) return def;
  const a = (await ask(`${q} ${def ? "(Y/n)" : "(y/N)"}: `)).trim().toLowerCase();
  if (!a) return def;
  return a === "y" || a === "s" || a === "yes" || a === "si";
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
  if (fileHas(path.join(CWD, "pom.xml"), /spring-boot/i) || fileHas(path.join(CWD, "build.gradle"), /spring/i) || fileHas(path.join(CWD, "build.gradle.kts"), /spring/i)) return "backend/spring";
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

// ---------- copia de archivos ----------
// overwrite=false (default): solo copia lo que no existe (skip-existing).
// overwrite=true (--update): sobrescribe lo existente con la versión del kit.
function copyNew(src, dest, skip, base, overwrite) {
  base = base || src;
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    const rel = path.relative(base, s).split(path.sep).join("/");
    if (skip && skip(rel)) {
      console.log(`  ⏭️  omitido (claude-flow lo cubre): ${rel}`);
      continue;
    }
    if (entry.isDirectory()) {
      if (!FLAGS.dryRun) fs.mkdirSync(d, { recursive: true });
      copyNew(s, d, skip, base, overwrite);
    } else {
      const existed = fs.existsSync(d);
      if (existed && !overwrite) continue; // skip-existing
      const icon = existed ? "🔁" : "➕";
      if (FLAGS.dryRun) {
        console.log(`  (dry-run) ${icon} ${path.relative(CWD, d)}`);
      } else {
        fs.copyFileSync(s, d);
        console.log(`  ${icon} ${path.relative(CWD, d)}`);
      }
    }
  }
}

function mcpHasFlow() {
  const m = readJSON(path.join(CWD, ".mcp.json"));
  return !!(m && m.mcpServers && Object.keys(m.mcpServers).some((k) => /flow/i.test(k)));
}

// Asegura que .gitignore cubra memoria/runtime/backups/secretos (idempotente).
function ensureGitignore() {
  const gi = path.join(CWD, ".gitignore");
  const needed = [".claude/memory/", ".claude-flow/", ".swarm/", ".claude.backup.*", ".env", ".env.*"];
  const cur = fs.existsSync(gi) ? fs.readFileSync(gi, "utf8") : "";
  const have = new Set(cur.split(/\r?\n/).map((l) => l.trim()));
  const add = needed.filter((n) => !have.has(n));
  if (!add.length) {
    console.log("  ✓ .gitignore ya cubre memoria/runtime/secretos.");
    return;
  }
  if (FLAGS.dryRun) {
    console.log(`  (dry-run) añadiría a .gitignore: ${add.join(", ")}`);
    return;
  }
  const block = (cur && !cur.endsWith("\n") ? "\n" : "") + "\n# dev-starter-kit\n" + add.join("\n") + "\n";
  fs.writeFileSync(gi, cur + block);
  console.log(`  ➕ .gitignore += ${add.join("  ")}`);
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
  console.log("  ➕ ./.env.example (rellénalo y añade tus variables)");
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
    console.log("\nStacks disponibles:\n  " + Object.keys(STACKS).join("\n  "));
    stackId = (await ask("\nElige stack (category/stack): ")).trim();
    if (!STACKS[stackId]) {
      console.error("❌ Stack inválido.");
      return rl.close();
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
  if (FLAGS.update) {
    console.log("  🔄 Modo actualización: sobrescribo los archivos del kit con la última versión (memoria y CLAUDE.project.md se conservan).");
  }
  if (!FLAGS.dryRun) fs.mkdirSync(claudeDir, { recursive: true });
  // Solo se omiten los 5 agentes core cuyo NOMBRE colisiona con claude-flow (agents/core/*).
  // El resto de agentes top-level (security-engineer, api-security-audit, ...) se conservan;
  // si claude-flow ya trae uno con el mismo path, copyNew lo respeta por skip-existing.
  const FLOW_CORE_COLISION = /^agents\/(coder|planner|reviewer|tester|researcher)\.md$/;
  copyNew(path.join(KIT, "shared", ".claude"), claudeDir, (rel) => {
    if (flowInstalled && FLOW_CORE_COLISION.test(rel)) return true;
    // En --update no pisamos settings.json si claude-flow es dueño del runtime.
    if (FLAGS.update && flowInstalled && rel === "settings.json") return true;
    return false;
  }, undefined, FLAGS.update);

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
  rl.close();
}

main().catch((e) => {
  console.error(e);
  rl.close();
  process.exit(1);
});
