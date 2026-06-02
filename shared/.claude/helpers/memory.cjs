// Memoria persistente local a cada proyecto (relativa a este helper, no a cwd).
// Vive en <proyecto>/.claude/memory/ y se autogitignorea.
const fs = require("fs");
const path = require("path");

const MEM_DIR = path.resolve(__dirname, "..", "memory");
const MEM_FILE = path.join(MEM_DIR, "memory.jsonl");

function ensure() {
  fs.mkdirSync(MEM_DIR, { recursive: true });
  const gi = path.join(MEM_DIR, ".gitignore");
  if (!fs.existsSync(gi)) fs.writeFileSync(gi, "*\n!.gitignore\n");
}

function append(entry) {
  ensure();
  fs.appendFileSync(MEM_FILE, JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n");
}

function readAll() {
  if (!fs.existsSync(MEM_FILE)) return [];
  return fs
    .readFileSync(MEM_FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch (_) {
        return null;
      }
    })
    .filter(Boolean);
}

function recent(n = 20) {
  return readAll().slice(-n);
}

module.exports = { append, readAll, recent, MEM_DIR, MEM_FILE };
