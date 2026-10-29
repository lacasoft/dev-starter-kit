// Tests del helper que evalúa las reglas deny/ask de .claude/settings.json para la capa de Pi.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { load, decide, globToRegex } = require(path.join(__dirname, "..", "shared", ".claude", "helpers", "claude-permissions.cjs"));

const ROOT = "/proyecto";
const HOME = "/home/ana";
const ctx = { root: ROOT, cwd: ROOT, home: HOME };
const KIT = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "shared", ".claude", "settings.json"), "utf8")).permissions;
const reglas = { deny: KIT.deny, ask: [] };
const d = (tool, input, r = reglas) => decide(r, tool, input, ctx).decision;

test("globs estilo gitignore", () => {
  assert.ok(globToRegex("/a/**").test("/a/b/c"));
  assert.ok(globToRegex("/a/**/c.md").test("/a/c.md"));
  assert.ok(globToRegex("/a/*.env").test("/a/x.env"));
  assert.ok(!globToRegex("/a/*.env").test("/a/b/x.env"));
});

test("las denegaciones de lectura del kit cubren ~/.ssh, ~/.aws y los .env reales", () => {
  assert.equal(d("read", { path: "~/.ssh/id_rsa" }), "deny");
  assert.equal(d("read", { path: "/home/ana/.aws/credentials" }), "deny");
  assert.equal(d("read", { path: ".env" }), "deny");
  assert.equal(d("read", { path: "./.env.production" }), "deny");
  assert.equal(d("read", { path: ".env.example" }), null);
  assert.equal(d("read", { path: "src/app.ts" }), null);
});

test("Read cubre también grep, find y ls", () => {
  assert.equal(d("grep", { pattern: "x", path: "~/.ssh" }), "deny", "buscar en la carpeta leería su contenido");
  assert.equal(d("grep", { pattern: "x", path: "." }), null, "buscar en el proyecto sigue permitido");
  assert.equal(d("grep", { pattern: "x", path: "~/.ssh/config" }), "deny");
  assert.equal(d("ls", { path: "~/.aws/sso" }), "deny");
});

test("las denegaciones de Bash del kit, también dentro de un comando compuesto", () => {
  assert.equal(d("bash", { command: "sudo rm -rf build" }), "deny");
  assert.equal(d("bash", { command: "npm test && npm publish --access public" }), "deny");
  assert.equal(d("bash", { command: "chmod 777 script.sh" }), "deny");
  assert.equal(d("bash", { command: "npm test" }), null);
  assert.equal(d("bash", { command: "echo sudo" }), null, "solo cuenta el comando, no un argumento");
});

test("la forma antigua prefijo:* y las reglas sin paréntesis", () => {
  const r = { deny: ["Bash(git push:*)", "Edit"], ask: [] };
  assert.equal(d("bash", { command: "git push origin main" }, r), "deny");
  assert.equal(d("bash", { command: "git pushx" }, r), null);
  assert.equal(d("write", { path: "a.ts", content: "x" }, r), "deny", "Edit cubre write");
  assert.equal(d("read", { path: "a.ts" }, r), null);
});

test("ask y reglas de MCP; deny gana sobre ask", () => {
  const r = { deny: ["mcp__github__delete_repo"], ask: ["Bash(git push*)", "mcp__github"] };
  assert.equal(d("bash", { command: "git push" }, r), "ask");
  assert.equal(d("mcp__github__create_issue", {}, r), "ask");
  assert.equal(d("mcp__github__delete_repo", {}, r), "deny");
});

test("rutas absolutas (//) y relativas a la raíz (/)", () => {
  const r = { deny: ["Edit(//etc/**)", "Write(/infra/prod/**)"], ask: [] };
  assert.equal(d("edit", { path: "/etc/hosts" }, r), "deny");
  assert.equal(d("write", { path: "infra/prod/main.tf" }, r), "deny");
  assert.equal(d("write", { path: "infra/dev/main.tf" }, r), null);
});

test("load junta settings.json y settings.local.json sin duplicar", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-perms-"));
  fs.mkdirSync(path.join(dir, ".claude"));
  fs.writeFileSync(path.join(dir, ".claude", "settings.json"), JSON.stringify({ permissions: { deny: ["Bash(sudo *)"], allow: ["Bash(npm test)"] } }));
  fs.writeFileSync(path.join(dir, ".claude", "settings.local.json"), JSON.stringify({ permissions: { deny: ["Bash(sudo *)", "Bash(terraform destroy*)"], ask: ["Bash(git push*)"] } }));
  assert.deepEqual(load(dir), { deny: ["Bash(sudo *)", "Bash(terraform destroy*)"], ask: ["Bash(git push*)"] });
  fs.rmSync(dir, { recursive: true, force: true });
});
