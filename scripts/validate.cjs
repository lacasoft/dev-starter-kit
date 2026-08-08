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
const parsed = {};
for (const j of ["components.json", "shared/.claude/settings.json", "package.json"]) {
  const p = path.join(ROOT, j);
  try {
    parsed[j] = JSON.parse(fs.readFileSync(p, "utf8"));
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

// --- es-MX: peninsularismos prohibidos (agentes, skills, overlays, comandos, plantillas, helpers; ver CONTRIBUTING.md) ---
// Excluye CLAUDE.base.md y CONTRIBUTING.md a propósito: ahí vive el glosario que cita estos términos.
const ESMX = /\b(coste|costes|montar|montamos|montas|ordenador|ordenadores|fichero|ficheros|vale|pillas|pillamos|pill[eé])\b/i;
const esmxFiles = [
  ...agents,
  ...skills,
  ...stacks,
  ...walk(path.join(ROOT, "shared/.claude/commands"), (p) => p.endsWith(".md")),
  ...walk(path.join(ROOT, "shared/templates"), (p) => p.endsWith(".md")),
  ...walk(path.join(ROOT, "shared/.claude/helpers"), (p) => /\.(cjs|mjs|js)$/.test(p)),
  path.join(ROOT, "install.js"), // es el texto que más lee el usuario: sale por consola en cada instalación
];
for (const f of esmxFiles) {
  fs.readFileSync(f, "utf8")
    .split(/\r?\n/)
    .forEach((ln, i) => {
      const m = ln.match(ESMX);
      if (m) errors.push(`${rel(f)}:${i + 1}: peninsularismo "${m[1]}" — usa es-MX (ver CONTRIBUTING.md)`);
    });
}

// --- README ↔ realidad ---
// El README se desvía en silencio si nadie lo mira: llegó a listar helpers borrados dos releases
// antes, 9 de 13 stacks y "los 8 stacks" del CI. Aquí lo que afirma se comprueba contra el repo.
const README = path.join(ROOT, "README.md");
const readme = fs.existsSync(README) ? fs.readFileSync(README, "utf8") : "";
if (!readme) errors.push("README.md: no existe");

// Si reescribes una de estas frases, actualiza el patrón aquí: la comprobación no debe perderse
// en silencio, que es justo como el README se desactualizó.
function claim(label, re, esperado) {
  if (!readme) return;
  const m = readme.match(re);
  if (!m) return errors.push(`README.md: no encuentro la afirmación sobre ${label} (patrón ${re}); si la reescribiste, actualiza scripts/validate.cjs`);
  const dicho = Number(m[1]);
  if (dicho !== esperado) errors.push(`README.md: dice ${dicho} ${label}, pero el repo tiene ${esperado}`);
  else ok.push(`README: ${label} = ${esperado}`);
}
claim("agentes", /(\d+)\s+agentes/, agents.length);
claim("skills", /(\d+)\s+skills/, skills.length);
claim("stacks seleccionables", /(\d+)\s+stacks seleccionables/, declIds.size);
claim("stacks cubiertos por el CI", /\*\*(\d+) stacks\*\*/, declIds.size);
if (parsed["components.json"]) {
  claim("componentes descartados", /los\s+(\d+)\s+con su motivo/, Object.keys(parsed["components.json"].discarded || {}).length);
}

// Lista de helpers del árbol: debe coincidir exactamente con los archivos reales.
if (readme) {
  const reales = fs
    .readdirSync(path.join(ROOT, "shared/.claude/helpers"))
    .map((f) => f.replace(/\.(cjs|mjs|js)$/, ""))
    .sort();
  const m = readme.match(/helpers\/\s+#\s*(.+)/);
  if (!m) errors.push("README.md: no encuentro la línea de helpers en el árbol de estructura");
  else {
    const dichos = m[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
    if (dichos.join("|") !== reales.join("|")) {
      errors.push(`README.md: el árbol lista helpers [${dichos.join(", ")}] y el repo tiene [${reales.join(", ")}]`);
    } else ok.push("README: lista de helpers");
  }
}

// Stacks por categoría del árbol: backend/{...}, frontend/{...}, mobile/{...}.
if (readme) {
  for (const cat of fs.readdirSync(path.join(ROOT, "stacks"), { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const reales = fs
      .readdirSync(path.join(ROOT, "stacks", cat.name), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    const m = readme.match(new RegExp(`${cat.name}/\\{([^}]+)\\}`));
    if (!m) {
      // Categorías de un solo stack se escriben sin llaves (blockchain/solidity): basta con que aparezcan.
      if (reales.some((s) => !readme.includes(`${cat.name}/${s}`))) {
        errors.push(`README.md: el árbol no menciona todos los stacks de ${cat.name} (${reales.join(", ")})`);
      }
      continue;
    }
    const dichos = m[1].split(",").map((s) => s.trim()).filter(Boolean).sort();
    if (dichos.join("|") !== reales.join("|")) {
      errors.push(`README.md: el árbol lista ${cat.name}/{${dichos.join(",")}} y el repo tiene {${reales.join(",")}}`);
    } else ok.push(`README: stacks de ${cat.name}`);
  }
}

// Ejemplos de instalación pineados: deben apuntar a la versión actual, o mandas a la gente a una vieja.
if (readme && parsed["package.json"]) {
  const pins = [...readme.matchAll(/dev-starter-kit#v(\d+\.\d+\.\d+)/g)].map((m) => m[1]);
  if (!pins.length) errors.push("README.md: no hay ningún ejemplo de instalación pineado por tag (#vX.Y.Z)");
  for (const p of new Set(pins)) {
    if (p !== parsed["package.json"].version) {
      errors.push(`README.md: ejemplo pineado a #v${p}, pero package.json está en ${parsed["package.json"].version}`);
    } else ok.push(`README: pin #v${p}`);
  }
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
