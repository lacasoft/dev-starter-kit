#!/usr/bin/env node
/**
 * validate.cjs — Comprueba la integridad del kit sin dependencias externas.
 * Lo usa `npm run validate` y la CI. Sale con código 1 si algo falla.
 *
 * Verifica:
 *  - Frontmatter de agentes (.claude/agents/*.md) y skills (skills/.../SKILL.md): --- name: description: ---
 *  - Sin entidades HTML sin escapar (&lt; / &gt;) en agentes/skills
 *  - JSON válido: components.json, shared/.claude/settings.json
 *  - Sintaxis JS: install.js, helpers, este script
 *  - Overlays de stack presentes y no vacíos; plantilla de proyecto presente
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const ok = [];
const rel = (p) => path.relative(ROOT, p);

function walk(dir, test, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, test, out);
    else if (test(p)) out.push(p);
  }
  return out;
}

// --- frontmatter ---
function checkFrontmatter(file) {
  const txt = fs.readFileSync(file, "utf8");
  if (!txt.startsWith("---")) return errors.push(`${rel(file)}: sin frontmatter (--- al inicio)`);
  const end = txt.indexOf("\n---", 3);
  if (end === -1) return errors.push(`${rel(file)}: frontmatter sin cierre (---)`);
  const fm = txt.slice(3, end);
  if (!/^name:\s*\S/m.test(fm)) errors.push(`${rel(file)}: falta "name:" en frontmatter`);
  if (!/^description:\s*\S/m.test(fm)) errors.push(`${rel(file)}: falta "description:" en frontmatter`);
  if (/&lt;|&gt;|&amp;lt;/.test(txt)) errors.push(`${rel(file)}: contiene entidades HTML sin escapar (&lt;/&gt;)`);
  if (errors.length === 0 || !errors[errors.length - 1].startsWith(rel(file))) ok.push(rel(file));
}

const agents = walk(path.join(ROOT, "shared/.claude/agents"), (p) => p.endsWith(".md"));
const skills = walk(path.join(ROOT, "shared/.claude/skills"), (p) => p.endsWith("SKILL.md"));
[...agents, ...skills].forEach(checkFrontmatter);

// --- JSON ---
for (const j of ["components.json", "shared/.claude/settings.json"]) {
  const p = path.join(ROOT, j);
  try {
    JSON.parse(fs.readFileSync(p, "utf8"));
    ok.push(j);
  } catch (e) {
    errors.push(`${j}: JSON inválido → ${e.message}`);
  }
}

// --- sintaxis JS ---
const jsFiles = [
  "install.js",
  "scripts/validate.cjs",
  ...walk(path.join(ROOT, "shared/.claude/helpers"), (p) => /\.(cjs|mjs|js)$/.test(p)).map(rel),
];
for (const j of jsFiles) {
  try {
    execSync(`node --check ${JSON.stringify(path.join(ROOT, j))}`, { stdio: "ignore" });
    ok.push(j);
  } catch (_) {
    errors.push(`${j}: error de sintaxis JS`);
  }
}

// --- overlays de stack + plantilla ---
const stacks = walk(path.join(ROOT, "stacks"), (p) => p.endsWith("CLAUDE.md"));
if (stacks.length === 0) errors.push("stacks/: no hay overlays CLAUDE.md");
for (const s of stacks) {
  if (fs.readFileSync(s, "utf8").trim().length < 20) errors.push(`${rel(s)}: overlay vacío`);
}
const tpl = path.join(ROOT, "shared/templates/PROJECT.template.md");
if (!fs.existsSync(tpl)) errors.push("shared/templates/PROJECT.template.md: falta la plantilla de proyecto");

// --- cruce STACKS (install.js) ↔ overlays del filesystem ---
function fsStackIds() {
  const ids = new Set();
  const dir = path.join(ROOT, "stacks");
  if (!fs.existsSync(dir)) return ids;
  for (const cat of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    for (const st of fs.readdirSync(path.join(dir, cat.name), { withFileTypes: true })) {
      if (!st.isDirectory() || st.name === "_common") continue;
      if (fs.existsSync(path.join(dir, cat.name, st.name, ".claude", "CLAUDE.md"))) ids.add(`${cat.name}/${st.name}`);
    }
  }
  return ids;
}
function declaredStackIds() {
  const src = fs.readFileSync(path.join(ROOT, "install.js"), "utf8");
  const m = src.match(/const\s+STACKS\s*=\s*\{([\s\S]*?)\};/);
  const ids = new Set();
  if (m) for (const k of m[1].matchAll(/["']([^"']+\/[^"']+)["']\s*:/g)) ids.add(k[1]);
  return ids;
}
const fsIds = fsStackIds();
const declIds = declaredStackIds();
if (declIds.size === 0) errors.push("install.js: no se pudo extraer el objeto STACKS");
for (const id of declIds) if (!fsIds.has(id)) errors.push(`STACKS["${id}"] (install.js) sin overlay stacks/${id}/.claude/CLAUDE.md`);
for (const id of fsIds) if (!declIds.has(id)) errors.push(`overlay stacks/${id} sin entrada en STACKS de install.js (no se detectaría)`);

// --- es-MX: peninsularismos prohibidos (solo agentes, skills y overlays; ver CONTRIBUTING.md) ---
const ESMX = /\b(coste|costes|montar|montamos|montas|ordenador|ordenadores|fichero|ficheros|vale|pillas|pillamos|pill[eé])\b/i;
for (const f of [...agents, ...skills, ...stacks]) {
  fs.readFileSync(f, "utf8")
    .split(/\r?\n/)
    .forEach((ln, i) => {
      const m = ln.match(ESMX);
      if (m) errors.push(`${rel(f)}:${i + 1}: peninsularismo "${m[1]}" — usa es-MX (ver CONTRIBUTING.md)`);
    });
}

// --- reporte ---
console.log(`\n🔎 Validación del kit`);
console.log(`   agentes: ${agents.length} · skills: ${skills.length} · overlays: ${stacks.length} · JS: ${jsFiles.length}`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} problema(s):`);
  errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}
console.log(`\n✅ Todo correcto (${ok.length} comprobaciones).`);
