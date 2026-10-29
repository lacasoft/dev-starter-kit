#!/usr/bin/env node
/**
 * claude-rules.cjs — las reglas de .claude/rules/ que Claude Code carga por su cuenta, para agentes
 * que no las leen (Pi Agent). Zero-dep; lo usa .pi/extensions/.
 *
 *   node .claude/helpers/claude-rules.cjs     lista las reglas y cuándo aplica cada una
 *
 * Como en Claude Code: una regla sin `paths:` en su frontmatter se carga siempre (proyecto de un
 * stack, reglas propias del equipo); una con `paths:` solo al trabajar en archivos que coinciden
 * (en monorepo, la carpeta de cada stack).
 */
const fs = require("fs");
const path = require("path");

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", "..");

const unquote = (s) => s.trim().replace(/^["']|["']$/g, "");

/** Separa el frontmatter de una regla: sus `paths` (lista YAML, en línea o con guiones) y el cuerpo. */
function parse(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { paths: [], body: text };
  const paths = [];
  let enPaths = false;
  for (const line of m[1].split(/\r?\n/)) {
    const key = line.match(/^([\w-]+):\s*(.*)$/);
    if (key) {
      enPaths = key[1] === "paths";
      const v = key[2].trim();
      if (enPaths && v) paths.push(...v.replace(/^\[|\]$/g, "").split(",").map(unquote).filter(Boolean));
      continue;
    }
    const item = enPaths && line.match(/^\s*-\s*(.+?)\s*$/);
    if (item) paths.push(unquote(item[1]));
  }
  return { paths, body: text.slice(m[0].length) };
}

/** Todas las reglas `.md` de .claude/rules/ (recursivo), en orden estable. */
function load(root = ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".md")) {
        const { paths, body } = parse(fs.readFileSync(p, "utf8"));
        out.push({ file: p, rel: path.relative(root, p).split(path.sep).join("/"), always: !paths.length, paths, body });
      }
    }
  };
  const dir = path.join(root, ".claude", "rules");
  if (fs.existsSync(dir)) walk(dir);
  return out;
}

module.exports = { parse, load };

if (require.main === module) {
  const reglas = load();
  if (!reglas.length) console.log("No hay reglas en .claude/rules/.");
  for (const r of reglas) console.log(`${r.rel}: ${r.always ? "siempre" : `al trabajar en ${r.paths.join(", ")}`}`);
}
