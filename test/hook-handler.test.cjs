// Tests del hook-handler (zero-dep, node:test). Lo más delicado del kit:
// los guards de rm -rf / push --force y el escáner de secretos con su allowlist.
// Correr: `npm test` o `node --test`.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const HH = path.join(__dirname, "..", "shared", ".claude", "helpers", "hook-handler.cjs");

function run(action, payload) {
  const r = spawnSync("node", [HH, action], { input: JSON.stringify(payload), encoding: "utf8" });
  return { code: r.status, out: r.stdout || "" };
}
function decision(payload) {
  const { out } = run("pre-edit", payload);
  if (!out.trim()) return null;
  try {
    return JSON.parse(out).hookSpecificOutput;
  } catch (_) {
    return null;
  }
}

// ---- pre-bash: guards destructivos ----
test("pre-bash BLOQUEA rm -rf /", () => assert.equal(run("pre-bash", { tool_input: { command: "rm -rf /" } }).code, 2));
test("pre-bash BLOQUEA rm -rf $HOME", () => assert.equal(run("pre-bash", { tool_input: { command: "rm -rf $HOME" } }).code, 2));
test("pre-bash BLOQUEA rm -fr ~", () => assert.equal(run("pre-bash", { tool_input: { command: "rm -fr ~" } }).code, 2));
test("pre-bash PERMITE rm -rf ./build (no es raíz)", () =>
  assert.equal(run("pre-bash", { tool_input: { command: "rm -rf ./build" } }).code, 0));
test("pre-bash PERMITE rm -rf node_modules", () =>
  assert.equal(run("pre-bash", { tool_input: { command: "rm -rf node_modules" } }).code, 0));
test("pre-bash BLOQUEA push --force a main", () =>
  assert.equal(run("pre-bash", { tool_input: { command: "git push --force origin main" } }).code, 2));
test("pre-bash BLOQUEA push -f a master", () =>
  assert.equal(run("pre-bash", { tool_input: { command: "git push -f origin master" } }).code, 2));
test("pre-bash PERMITE push --force-with-lease a feature", () =>
  assert.equal(run("pre-bash", { tool_input: { command: "git push --force-with-lease origin feat/x" } }).code, 0));

// ---- pre-edit: escáner de secretos ----
// Fixtures tipo-secreto construidos por concatenación para no dejar literales
// que disparen el push protection de GitHub (el string se forma en runtime).
test("DENY secreto AWS en content (Write)", () => {
  const d = decision({ tool_input: { content: 'const key = "' + "AKIA" + "1234567890ABCDEF" + '";' } });
  assert.equal(d && d.permissionDecision, "deny");
});
test("DENY secreto Anthropic en new_string (Edit)", () => {
  const d = decision({ tool_input: { new_string: "sk-" + "ant-" + "a".repeat(42) } });
  assert.equal(d && d.permissionDecision, "deny");
});
test("DENY secreto en edits[] (MultiEdit)", () => {
  const d = decision({ tool_input: { edits: [{ new_string: "x" }, { new_string: 'password = "S3cretP4ssw0rd!"' }] } });
  assert.equal(d && d.permissionDecision, "deny");
});
test("PERMITE contenido benigno (sin salida)", () => {
  assert.equal(decision({ tool_input: { content: "export const x = 1;" } }), null);
});
test("ALLOWLIST: placeholder no se bloquea", () => {
  assert.equal(decision({ tool_input: { content: 'api_key = "your_api_key_here"' } }), null);
});
test("ALLOWLIST: clave de test de Stripe no se bloquea", () => {
  assert.equal(decision({ tool_input: { content: 'key = "' + "sk_" + "test_" + "abcdefghijklmnopqrstuvwx" + '"' } }), null);
});
test(".env emite additionalContext sin bloquear", () => {
  const d = decision({ tool_input: { file_path: ".env", content: "FOO=bar" } });
  assert.ok(d && d.additionalContext && !d.permissionDecision);
});
