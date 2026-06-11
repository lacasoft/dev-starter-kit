#!/usr/bin/env node
/**
 * Entry-point único de hooks. Claude Code pasa el payload del hook como JSON por STDIN.
 * Acciones (1ª arg): pre-bash, pre-edit, post-edit, post-bash,
 *                     session-restore, session-end, post-task, notify, compact-manual, compact-auto, status.
 *
 * Diseño: solo bloquea en casos peligrosos explícitos — comandos destructivos (rm -rf /,
 * push --force a rama protegida) con exit 2, y secretos en ediciones con JSON permissionDecision
 * "deny". Nunca falla la sesión por un error interno (el resto sale con exit 0).
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

// Escaneo de secretos en contenido recién escrito. En pre-edit, un acierto BLOQUEA la
// herramienta con permissionDecision "deny" (el modelo recibe el motivo).
// Catálogo por proveedor + allowlist de falsos positivos, destilado de Cyber Neo
// (github.com/Hainrixz/cyber-neo, MIT). Pares [nombre, regex].
const SECRET_PATTERNS = [
  ["AWS Access Key", /\bAKIA[0-9A-Z]{16}\b/],
  ["AWS Secret Key", /aws_secret_access_key\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i],
  ["GCP API Key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["GCP Service Account", /"type"\s*:\s*"service_account"/],
  ["Azure Connection String", /AccountName=[^;]+;AccountKey=[A-Za-z0-9+/=]{88}/i],
  ["GitHub Token", /\bgh[posru]_[A-Za-z0-9_]{36,}\b/],
  ["GitHub Fine-Grained PAT", /\bgithub_pat_[A-Za-z0-9_]{22,}\b/],
  ["GitLab PAT", /\bglpat-[A-Za-z0-9_-]{20}\b/],
  ["Slack Token", /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
  ["Slack Webhook", /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{24}/],
  ["Stripe Secret Key", /\b[rs]k_live_[0-9a-zA-Z]{24,}\b/],
  ["SendGrid API Key", /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/],
  ["Twilio API Key", /\bSK[0-9a-fA-F]{32}\b/],
  ["Shopify Token", /\bshp(?:at|ss|ca|pa)_[a-fA-F0-9]{32}\b/],
  ["npm Token", /\bnpm_[A-Za-z0-9]{36}\b/],
  ["PyPI Token", /\bpypi-[A-Za-z0-9_-]{16,}/],
  ["OpenAI Key", /\bsk-(?:proj-)?[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20,}/],
  ["OpenAI Project Key", /\bsk-proj-[A-Za-z0-9_-]{40,}/],
  ["Anthropic Key", /\bsk-ant-[A-Za-z0-9_-]{40,}/],
  ["Google OAuth Token", /\bya29\.[A-Za-z0-9_-]{20,}/],
  ["PostgreSQL URL", /postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/],
  ["MySQL URL", /mysql:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/],
  ["MongoDB URL", /mongodb(?:\+srv)?:\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/],
  ["Redis URL", /redis:\/\/[^\s'"]*:[^\s'"]+@[^\s'"]+/],
  ["Private Key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["Bearer Token", /authorization['"]?\s*[=:]\s*['"]?Bearer\s+[A-Za-z0-9_.-]{20,}/i],
  ["Hardcoded Password", /(?:password|passwd|pwd)\s*[=:]\s*['"][^'"]{8,}['"]/i],
  ["Hardcoded Secret", /(?:secret|secret[_-]?key)\s*[=:]\s*['"][^'"]{8,}['"]/i],
  ["Hardcoded API Key", /(?:api[_-]?key|apikey)\s*[=:]\s*['"][^'"]{8,}['"]/i],
  ["Hardcoded Token", /(?:access[_-]?token|auth[_-]?token)\s*[=:]\s*['"][^'"]{8,}['"]/i],
];

// Falsos positivos comunes: placeholders, claves de test, interpolaciones.
const SECRET_ALLOWLIST = [
  /(?:your|my|example|fake|dummy|placeholder|sample|changeme|redacted|insert|replace)[_-]/i,
  /x{3,}|<your|\$\{|\{\{/i,
  /\bsk_test_|\bpk_test_/,
  /example\.(?:com|org|net)/i,
];

function scanSecrets(text) {
  if (!text) return null;
  for (const line of String(text).split(/\r?\n/)) {
    if (line.length > 2000) continue; // saltar líneas minificadas/binarias
    if (SECRET_ALLOWLIST.some((rx) => rx.test(line))) continue; // placeholder/test → ignora
    for (const [name, re] of SECRET_PATTERNS) if (re.test(line)) return name;
  }
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

// Salida JSON de PreToolUse: deny BLOQUEA y el modelo recibe el motivo;
// addContext inyecta una nota al modelo sin bloquear. (exit 0 + stderr es invisible al modelo.)
function denyPreTool(reason) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })
  );
  process.exit(0);
}
function addContext(text) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: text } }));
}

const payload = readPayload();
const toolInput = payload.tool_input || {};

switch (action) {
  case "pre-bash": {
    const cmd = toolInput.command || "";
    const esRmRf = /\brm\s+-[a-z]*r[a-z]*f|\brm\s+-[a-z]*f[a-z]*r/i.test(cmd);
    const sobreRaiz = /\s(\/|~|\$HOME)(\s|\/|\*|$)/.test(cmd);
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
    // Recolecta TODO el contenido a escribir: Write(content), Edit(new_string), MultiEdit(edits[].new_string).
    const parts = [];
    if (toolInput.content) parts.push(toolInput.content);
    if (toolInput.new_string) parts.push(toolInput.new_string);
    if (Array.isArray(toolInput.edits)) for (const e of toolInput.edits) if (e && e.new_string) parts.push(e.new_string);
    const hit = scanSecrets(parts.join("\n"));
    if (hit) {
      // Bloquea Y el modelo recibe el motivo (no un aviso invisible).
      denyPreTool(
        `Posible secreto (${hit}) en el contenido a escribir${file ? ` en ${file}` : ""}. No hardcodees secretos: usa variables de entorno / secret manager. Si es un placeholder/ejemplo, hazlo evidente (p.ej. prefijo your_/example_).`
      );
    }
    if (/(^|\/)\.env(\.|$)/.test(file)) {
      addContext(`Editando un archivo de entorno (${file}): no versiones secretos reales; usa .env.example con placeholders.`);
    }
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
