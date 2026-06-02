#!/usr/bin/env node
// Statusline: lee el JSON de Claude Code por stdin y muestra modelo | carpeta | rama git | memoria.
const fs = require("fs");
const path = require("path");

let d = {};
try {
  const raw = fs.readFileSync(0, "utf8");
  if (raw.trim()) d = JSON.parse(raw);
} catch (_) {}

const model = (d.model && (d.model.display_name || d.model.id)) || "claude";
const dir = (d.workspace && d.workspace.current_dir) || d.cwd || process.cwd();
const carpeta = String(dir).split("/").filter(Boolean).pop() || dir;

let rama = "";
try {
  rama = require("child_process")
    .execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["ignore", "pipe", "ignore"], timeout: 2000 })
    .toString()
    .trim();
} catch (_) {}

// Nº de entradas de memoria del proyecto (si existe).
let mem = 0;
try {
  const memFile = path.join(dir, ".claude", "memory", "memory.jsonl");
  if (fs.existsSync(memFile)) mem = fs.readFileSync(memFile, "utf8").split("\n").filter(Boolean).length;
} catch (_) {}

const parts = [`🤖 ${model}`, `📁 ${carpeta}`];
if (rama) parts.push(`🌿 ${rama}`);
if (mem) parts.push(`🧠 ${mem}`);
process.stdout.write(parts.join(" | "));
