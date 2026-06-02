// Estado de la última sesión por proyecto en .claude/memory/session.json.
const fs = require("fs");
const path = require("path");

const FILE = path.resolve(__dirname, "..", "memory", "session.json");

function save(state) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(state, null, 2));
}

function load() {
  if (!fs.existsSync(FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (_) {
    return null;
  }
}

module.exports = { save, load, FILE };
