#!/usr/bin/env node
/**
 * claude-permissions.cjs — evalúa las reglas `deny` y `ask` de .claude/settings.json (y de
 * settings.local.json) como Claude Code, para agentes que no las aplican (Pi Agent). Zero-dep;
 * lo usa .pi/extensions/. Solo deny y ask: lo demás Pi ya lo hace sin preguntar.
 *
 *   node .claude/helpers/claude-permissions.cjs   lista las reglas deny y ask que se aplicarían
 *
 * Reglas soportadas:
 *   Herramienta              toda la herramienta (Bash, Read, Edit, Write, o una de MCP: mcp__servidor)
 *   Bash(<patrón>)           el comando, con * como comodín ("prefijo:*" es la forma antigua);
 *                            un comando compuesto (&&, ||, ;, |) se revisa por partes.
 *   Read|Edit|Write(<ruta>)  estilo gitignore: ** cualquier cosa, * dentro de un segmento.
 *                            //ruta es absoluta, ~/ruta está en tu home, /ruta y ./ruta parten de la raíz.
 * Como en Claude Code, Read cubre también las herramientas de búsqueda (grep, find, ls) y Edit o
 * Write cubren cualquier herramienta que escriba archivos.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", "..");

// Herramienta de Pi → reglas de Claude que le aplican.
const CLAUDE_TOOLS = {
  bash: ["Bash"],
  powershell: ["Bash"],
  read: ["Read"],
  grep: ["Read"],
  find: ["Read"],
  ls: ["Read"],
  write: ["Edit", "Write"],
  edit: ["Edit", "Write"],
};

/** Reglas deny y ask de settings.json y settings.local.json de .claude/, sin duplicados. */
function load(root = ROOT) {
  const rules = { deny: [], ask: [] };
  for (const f of ["settings.json", "settings.local.json"]) {
    let s;
    try {
      s = JSON.parse(fs.readFileSync(path.join(root, ".claude", f), "utf8"));
    } catch (_) {
      continue;
    }
    for (const k of ["deny", "ask"]) {
      for (const r of (s.permissions && s.permissions[k]) || []) if (typeof r === "string" && !rules[k].includes(r)) rules[k].push(r);
    }
  }
  return rules;
}

function globToRegex(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "\\" && i + 1 < glob.length) {
      re += glob[++i].replace(/[.+^${}()|[\]\\*?]/g, "\\$&"); // \[ y similares: el carácter literal
      continue;
    }
    if (c === "*" && glob[i + 1] === "*") {
      i++;
      if (glob[i + 1] === "/") {
        i++;
        re += "(?:.*/)?";
      } else re += ".*";
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

function pathMatches(spec, target, { root, home }) {
  let abs;
  if (spec.startsWith("//")) abs = spec.slice(1);
  else if (spec.startsWith("~/")) abs = path.join(home, spec.slice(2));
  else if (spec.startsWith("/")) abs = path.join(root, spec.slice(1));
  else abs = path.join(root, spec.replace(/^\.\//, ""));
  // path.join normaliza, pero conserva los comodines; con una barra final, la carpeta y su contenido.
  if (spec.endsWith("/")) abs += "/**";
  // "carpeta/**" protege también la carpeta misma: si no, grep o find sobre ella leerían todo su contenido.
  if (abs.endsWith("/**") && target === abs.slice(0, -3)) return true;
  return globToRegex(abs).test(target);
}

function commandMatches(spec, command) {
  const re = spec.endsWith(":*")
    ? new RegExp(`^${spec.slice(0, -2).replace(/[.+^${}()|[\]\\*?]/g, "\\$&")}(\\s.*)?$`)
    : new RegExp(`^${spec.split("*").map((p) => p.replace(/[.+^${}()|[\]\\?]/g, "\\$&")).join(".*")}$`);
  return command
    .split(/&&|\|\||;|\||\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .some((p) => re.test(p));
}

function ruleMatches(rule, toolName, input, ctx) {
  const m = rule.match(/^([\w-]+)(?:\((.*)\))?$/s);
  if (!m) return false;
  const [, tool, spec] = m;
  const claude = CLAUDE_TOOLS[toolName] || [];
  if (spec === undefined) return claude.includes(tool) || toolName === tool || toolName.startsWith(`${tool}__`);
  if (!claude.includes(tool)) return false;
  if (tool === "Bash") return typeof input.command === "string" && commandMatches(spec, input.command);
  const p = input.path === undefined ? "." : String(input.path);
  const target = p.startsWith("~/") ? path.join(ctx.home, p.slice(2)) : path.resolve(ctx.cwd, p);
  return pathMatches(spec, target, ctx);
}

/**
 * Decide una llamada de Pi: { decision: "deny" | "ask" | null, rule }. deny gana sobre ask.
 * `ctx`: { root, cwd, home } (por defecto la raíz del proyecto y tu home).
 */
function decide(rules, toolName, input = {}, ctx = {}) {
  const c = { root: ctx.root || ROOT, cwd: ctx.cwd || ctx.root || ROOT, home: ctx.home || os.homedir() };
  for (const k of ["deny", "ask"]) {
    const rule = rules[k].find((r) => ruleMatches(r, toolName, input, c));
    if (rule) return { decision: k, rule };
  }
  return { decision: null, rule: null };
}

module.exports = { load, decide, globToRegex };

if (require.main === module) {
  const r = load();
  console.log(`deny: ${r.deny.join(", ") || "—"}\nask:  ${r.ask.join(", ") || "—"}`);
}
