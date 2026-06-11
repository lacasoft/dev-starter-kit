#!/usr/bin/env node
// Imprime los stack ids declarados en install.js (uno por línea).
// Fuente ÚNICA de verdad para el CI (smoke test) y cualquier script: no dupliques la lista a mano.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "install.js"), "utf8");
const m = src.match(/const\s+STACKS\s*=\s*\{([\s\S]*?)\};/);
if (!m) {
  console.error("No se pudo extraer STACKS de install.js");
  process.exit(1);
}
for (const k of m[1].matchAll(/["']([^"']+\/[^"']+)["']\s*:/g)) console.log(k[1]);
