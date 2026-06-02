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

// --- reporte ---
console.log(`\n🔎 Validación del kit`);
console.log(`   agentes: ${agents.length} · skills: ${skills.length} · overlays: ${stacks.length} · JS: ${jsFiles.length}`);
if (errors.length) {
  console.error(`\n❌ ${errors.length} problema(s):`);
  errors.forEach((e) => console.error(`   - ${e}`));
  process.exit(1);
}
console.log(`\n✅ Todo correcto (${ok.length} comprobaciones).`);
