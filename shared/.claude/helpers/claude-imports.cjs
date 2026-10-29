#!/usr/bin/env node
/**
 * claude-imports.cjs — expande los @imports de CLAUDE.md como lo hace Claude Code, para agentes
 * que leen CLAUDE.md pero no los resuelven (Pi Agent). Zero-dep; lo usa .pi/extensions/.
 *
 *   node .claude/helpers/claude-imports.cjs [archivo]   imprime el archivo con sus imports expandidos
 *
 * Reglas de Claude Code: `@ruta` al inicio de línea o tras un espacio, fuera de bloques y spans de
 * código; la ruta es relativa al archivo que la contiene (o absoluta, o ~/…); hasta 5 saltos y sin
 * ciclos. Un import que no existe queda como texto. Además, nunca expande archivos de entorno
 * reales (.env, .env.local…; los .example sí) ni nada de ~/.ssh o ~/.aws.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const MAX_DEPTH = 5;
const TOKEN = /(^|\s)@([^\s`'"<>()[\]{}]+)/g;

function resolveTarget(ref, fromFile, home) {
  // "Ver @notas.md." → la puntuación final no es parte de la ruta, salvo que el archivo exista así.
  for (const r of [ref, ref.replace(/[.,;:!?]+$/, "")]) {
    const p = r.startsWith("~/") ? path.join(home, r.slice(2)) : path.resolve(path.dirname(fromFile), r);
    try {
      if (fs.statSync(p).isFile()) return fs.realpathSync(p);
    } catch (_) {}
  }
  return null;
}

function blocked(p, home) {
  const base = path.basename(p);
  if (/^\.env(rc|\..+)?$/.test(base) && !/\.(example|sample|template)$/.test(base)) return true;
  return [".ssh", ".aws"].some((d) => p.startsWith(path.join(home, d) + path.sep));
}

/** Devuelve `text` (el contenido de `file`) con sus imports expandidos en el lugar donde aparecen. */
function expand(file, text, opts = {}, depth = 0, seen = new Set()) {
  const home = opts.home || os.homedir();
  const self = fs.existsSync(file) ? fs.realpathSync(file) : path.resolve(file);
  const chain = new Set(seen).add(self);
  const included = new Set(); // un archivo importado dos veces en el mismo texto entra una sola vez
  const out = [];
  let fence = null;
  for (const line of text.split("\n")) {
    const f = line.match(/^\s*(```|~~~)/);
    if (f) {
      if (!fence) fence = f[1];
      else if (f[1] === fence) fence = null;
      out.push(line);
      continue;
    }
    if (fence || depth >= MAX_DEPTH) {
      out.push(line);
      continue;
    }
    // Los spans de código se tapan con espacios: así sus @ no cuentan y las posiciones se conservan.
    const bare = line.replace(/`[^`]*`/g, (m) => " ".repeat(m.length));
    const found = [];
    for (const m of bare.matchAll(TOKEN)) {
      const target = resolveTarget(m[2], file, home);
      if (target && !chain.has(target) && !blocked(target, home)) found.push({ ref: m[2], target });
    }
    if (!found.length) {
      out.push(line);
      continue;
    }
    // Una línea que solo trae imports se sustituye; si además tiene texto, se conserva y los
    // archivos van debajo.
    const rest = found.reduce((s, { ref }) => s.split(`@${ref}`).join(""), bare).trim();
    if (rest) out.push(line);
    for (const { ref, target } of found) {
      if (included.has(target)) continue;
      included.add(target);
      const body = expand(target, fs.readFileSync(target, "utf8"), opts, depth + 1, chain).replace(/\s+$/, "");
      // Marcadores sin "@": una segunda pasada no los confunde con imports.
      out.push(`<!-- import: ${ref} -->`, body, `<!-- /import: ${ref} -->`);
    }
  }
  return out.join("\n");
}

module.exports = { expand, MAX_DEPTH };

if (require.main === module) {
  const file = path.resolve(process.argv[2] || "CLAUDE.md");
  if (!fs.existsSync(file)) {
    console.error(`No existe ${file}.`);
    process.exit(1);
  }
  process.stdout.write(expand(file, fs.readFileSync(file, "utf8")) + "\n");
}
