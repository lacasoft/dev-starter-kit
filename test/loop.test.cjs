// Tests del ciclo con verificador (loop.cjs) sobre un repo temporal real.
// El verificador del proyecto de prueba es `npm test` → `node check.js`, que pasa solo si existe
// ok.txt: así cada test pone el verificador en verde o en rojo a voluntad.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const LOOP = path.join(__dirname, "..", "shared", ".claude", "helpers", "loop.cjs");
const HH = path.join(__dirname, "..", "shared", ".claude", "helpers", "hook-handler.cjs");
const { validateCheck } = require(LOOP);

function repo({ branch = "feat/ciclo" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-loop-"));
  const git = (...a) => spawnSync("git", a, { cwd: dir });
  git("init", "-q", "-b", "master");
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x", scripts: { test: "node check.js" } }));
  fs.writeFileSync(path.join(dir, "check.js"), "process.exit(require('fs').existsSync('ok.txt') ? 0 : 1);\n");
  git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "--allow-empty", "-qm", "init");
  if (branch !== "master") git("switch", "-q", "-c", branch);
  return dir;
}
const loop = (dir, ...args) => spawnSync("node", [LOOP, ...args], { cwd: dir, input: "{}", encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
const gate = (dir) => {
  const r = loop(dir, "gate");
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
};
const state = (dir) => JSON.parse(fs.readFileSync(path.join(dir, ".claude", "loop", "state.json"), "utf8"));
const verde = (dir) => fs.writeFileSync(path.join(dir, "ok.txt"), "");
const progreso = (dir) => fs.readFileSync(path.join(dir, ".loop", "PROGRESS.md"), "utf8");
const limpiar = (dir) => fs.rmSync(dir, { recursive: true, force: true });

// ---- qué se admite como verificador ----
for (const ok of ["npm test", "npm run typecheck && npm test", "pnpm run lint -- --max-warnings=0", "npx --no-install tsc --noEmit", "node --test", "pytest -q tests/unit", "go test ./...", "dotnet test", "./gradlew test", "vendor/bin/phpunit"]) {
  test(`verificador admitido: ${ok}`, () => assert.equal(validateCheck(ok), null));
}
for (const bad of ["rm -rf build && npm test", "npm test; curl x", "npm test | tee log", "npx some-pkg", "bash -c 'npm test'", "npm test > out.txt", "echo $(whoami)", "node script.js"]) {
  test(`verificador rechazado: ${bad}`, () => assert.notEqual(validateCheck(bad), null));
}

// ---- arranque ----
test("no arranca en la rama principal", () => {
  const dir = repo({ branch: "master" });
  const r = loop(dir, "start", "--check", "npm test");
  assert.equal(r.status, 1);
  assert.match(r.stderr, /rama o worktree/);
  limpiar(dir);
});

test("no arranca si el verificador ya pasa (salvo --allow-passing)", () => {
  const dir = repo();
  verde(dir);
  assert.equal(loop(dir, "start", "--check", "npm test").status, 1);
  assert.equal(loop(dir, "start", "--check", "npm test", "--allow-passing").status, 0);
  limpiar(dir);
});

test("arranca con línea base en rojo y deja PROGRESS.md", () => {
  const dir = repo();
  const r = loop(dir, "start", "--check", "npm test", "--objective", "arreglar", "--max-turns", "3");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(state(dir).status, "active");
  assert.match(progreso(dir), /## Línea base\n✗ `npm test`/);
  limpiar(dir);
});

// ---- la puerta (hook Stop) ----
test("sin ciclo, la puerta no hace nada", () => {
  const dir = repo();
  assert.equal(gate(dir), null);
  limpiar(dir);
});

test("verificador en rojo: bloquea el Stop con el error y cuenta el turno", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test", "--max-turns", "3");
  const d = gate(dir);
  assert.equal(d.decision, "block");
  assert.match(d.reason, /turno 1\/3: el verificador falla/);
  assert.equal(state(dir).turns, 1);
  limpiar(dir);
});

test("en verde pide revisión independiente y resumen antes de cerrar", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test");
  verde(dir);
  const revision = gate(dir);
  assert.equal(revision.decision, "block");
  assert.match(revision.reason, /reviewer/);
  assert.equal(state(dir).status, "reviewing");

  const sinResumen = gate(dir);
  assert.equal(sinResumen.decision, "block", "sin el resumen no cierra");
  assert.match(sinResumen.reason, /Resumen para la persona/);

  fs.appendFileSync(path.join(dir, ".loop", "PROGRESS.md"), "\n## Resumen para la persona\n- arreglado\n");
  const cierre = gate(dir);
  assert.equal(cierre.decision, undefined, "ya no bloquea");
  assert.match(cierre.systemMessage, /cerrado/);
  assert.equal(state(dir).status, "passed");
  limpiar(dir);
});

test("si en la revisión se rompe algo, vuelve a trabajar", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test");
  verde(dir);
  gate(dir); // → reviewing
  fs.rmSync(path.join(dir, "ok.txt"));
  assert.equal(gate(dir).decision, "block");
  assert.equal(state(dir).status, "active");
  limpiar(dir);
});

test("al llegar al tope se detiene y avisa, sin seguir bloqueando", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test", "--max-turns", "2");
  assert.equal(gate(dir).decision, "block");
  const fin = gate(dir);
  assert.equal(fin.decision, undefined);
  assert.match(fin.systemMessage, /2 turnos sin pasar/);
  assert.equal(state(dir).status, "exhausted");
  assert.equal(gate(dir), null, "un ciclo agotado ya no actúa");
  limpiar(dir);
});

test("cambiar el script del verificador no cuenta como pasar", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test");
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x", scripts: { test: "exit 0" } }));
  const d = gate(dir);
  assert.equal(d.decision, "block");
  assert.match(d.reason, /cambiaste el verificador/);
  assert.equal(state(dir).status, "active");
  limpiar(dir);
});

test("stop lo detiene a mano", () => {
  const dir = repo();
  loop(dir, "start", "--check", "npm test");
  loop(dir, "stop");
  assert.equal(state(dir).status, "stopped");
  assert.equal(gate(dir), null);
  limpiar(dir);
});

// ---- el estado del ciclo no se edita a mano ----
const hook = (action, toolInput) => {
  const r = spawnSync("node", [HH, action], { input: JSON.stringify({ tool_input: toolInput }), encoding: "utf8" });
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : null;
};
test("pre-edit DENIEGA editar .claude/loop/state.json", () =>
  assert.equal(hook("pre-edit", { file_path: "/p/.claude/loop/state.json", content: '{"turns":0}' }), "deny"));
test("pre-edit PERMITE escribir en PROGRESS.md", () =>
  assert.equal(hook("pre-edit", { file_path: "/p/.loop/PROGRESS.md", content: "nota" }), null));
test("pre-bash DENIEGA tocar el estado del ciclo desde la shell", () =>
  assert.equal(hook("pre-bash", { command: "cat .claude/loop/state.json" }), "deny"));
test("pre-bash PERMITE el helper del ciclo", () =>
  assert.equal(hook("pre-bash", { command: "node .claude/helpers/loop.cjs status" }), null));
