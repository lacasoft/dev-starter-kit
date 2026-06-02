#!/usr/bin/env node
/**
 * Entry-point único de hooks. Claude Code pasa el payload del hook como JSON por STDIN.
 * Acciones (1ª arg): pre-bash, pre-edit, post-edit, post-bash, route,
 *                     session-restore, session-end, post-task, notify, compact-manual, compact-auto, status.
 *
 * Diseño: NUNCA bloquea salvo casos peligrosos explícitos (rm -rf /). Nunca falla la sesión
 * por un error interno (siempre exit 0 excepto bloqueos intencionales con exit 2).
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const action = process.argv[2] || "";

function load(mod) {
  try {
    return require(path.join(__dirname, mod));
  } catch (_) {
    return null;
  }
}

function readPayload() {
  try {
    const raw = fs.readFileSync(0, "utf8");
    return raw.trim() ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

// Escaneo ligero de secretos en contenido recién escrito (no bloquea, solo avisa).
const SECRET_PATTERNS = [
  /\b(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{16,}/, // Stripe
  /\bAKIA[0-9A-Z]{16}\b/, // AWS access key
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, // GitHub token
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, // claves privadas
  /\b[A-Za-z0-9_-]*(?:api[_-]?key|secret|password|token)\b\s*[:=]\s*["'][^"']{12,}["']/i,
];

function scanSecrets(text) {
  if (!text) return null;
  for (const re of SECRET_PATTERNS) if (re.test(text)) return re;
  return null;
}

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: "ignore", timeout: 12000, ...opts });
    return true;
  } catch (_) {
    return false;
  }
}

const payload = readPayload();
const toolInput = payload.tool_input || {};

switch (action) {
  case "pre-bash": {
    const cmd = toolInput.command || "";
    const esRmRf = /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i.test(cmd);
    const sobreRaiz = /\s(\/|~|\$HOME)(\s|\/|$)/.test(cmd);
    if (esRmRf && sobreRaiz) {
      console.error("❌ Bloqueado: rm -rf sobre / o $HOME. Revisa el comando.");
      process.exit(2);
    }
    if (/\bgit\s+push\b.*\s(--force|-f)\b/.test(cmd) && /\b(main|master|develop)\b/.test(cmd)) {
      console.error("❌ Bloqueado: push --force a rama protegida. Usa --force-with-lease y confirma.");
      process.exit(2);
    }
    break;
  }

  case "pre-edit": {
    const file = toolInput.file_path || "";
    if (/(^|\/)\.env(\.|$)/.test(file)) {
      console.error(`⚠️  Editando archivo de entorno (${file}). No incluyas secretos reales en el repo.`);
    }
    const content = toolInput.content || toolInput.new_string || "";
    const hit = scanSecrets(content);
    if (hit) console.error(`⚠️  Posible secreto en el contenido a escribir (patrón ${hit}). Usa env vars.`);
    break;
  }

  case "post-edit": {
    const file = toolInput.file_path;
    if (!file || !fs.existsSync(file)) break;
    const ext = path.extname(file);
    // Formateo + lint best-effort, nunca bloquea.
    if (/\.(js|jsx|ts|tsx|css|scss|html|json|md|yml|yaml)$/.test(ext)) {
      run(`npx --no-install prettier --write ${JSON.stringify(file)}`);
      run(`npx --no-install eslint --fix ${JSON.stringify(file)}`);
    } else if (ext === ".py") {
      run(`black -q ${JSON.stringify(file)}`) || run(`ruff format ${JSON.stringify(file)}`);
    } else if (ext === ".go") {
      run(`gofmt -w ${JSON.stringify(file)}`);
    } else if (ext === ".php") {
      run(`php-cs-fixer fix ${JSON.stringify(file)} --quiet`);
    }
    break;
  }

  case "route": {
    const prompt = payload.prompt || "";
    const router = load("router.cjs");
    const intel = load("intelligence.cjs");
    if (prompt && router && intel) {
      try {
        intel.record({ kind: "prompt", text: String(prompt).slice(0, 500), agent: router.route(prompt) });
      } catch (_) {}
    }
    break;
  }

  case "session-restore": {
    const session = load("session.cjs");
    const prev = session && session.load();
    if (prev && prev.summary) process.stdout.write(`↩️  Sesión previa: ${prev.summary}\n`);
    break;
  }

  case "session-end":
  case "compact-manual":
  case "compact-auto": {
    const session = load("session.cjs");
    if (session) {
      try {
        session.save({ endedAt: new Date().toISOString(), reason: action });
      } catch (_) {}
    }
    break;
  }

  case "post-task":
  case "post-bash":
  case "status":
  case "notify":
  default:
    // Sin efectos: estos eventos existen para integrarse con claude-flow si está presente.
    break;
}

process.exit(0);
