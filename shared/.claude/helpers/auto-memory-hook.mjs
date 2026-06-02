#!/usr/bin/env node
// Memoria automática por proyecto. SessionStart "import" inyecta memoria reciente como contexto;
// Stop "sync" registra la sesión. Almacena en .claude/memory/ (local a cada proyecto).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const fs = require("node:fs");
const memory = require("./memory.cjs");

const action = process.argv[2] || "";
let payload = {};
try {
  const raw = fs.readFileSync(0, "utf8");
  if (raw.trim()) payload = JSON.parse(raw);
} catch (_) {}

if (action === "import") {
  const recientes = memory.recent(10).filter((e) => e.summary || e.text);
  if (recientes.length) {
    const lineas = recientes.map((e) => `- ${e.summary || e.text}`);
    process.stdout.write("🧠 Memoria del proyecto (recientes):\n" + lineas.join("\n") + "\n");
  }
} else if (action === "sync") {
  let eventos = null;
  const tp = payload.transcript_path;
  if (tp && fs.existsSync(tp)) {
    try {
      eventos = fs.readFileSync(tp, "utf8").split("\n").filter(Boolean).length;
    } catch (_) {}
  }
  memory.append({ kind: "session", summary: `sesión sincronizada${eventos ? ` (${eventos} eventos)` : ""}` });
}

process.exit(0);
