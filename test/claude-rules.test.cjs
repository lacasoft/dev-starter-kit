// Tests del helper que replica cómo Claude Code carga .claude/rules/ (lo usa la capa de Pi).
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HELPER = path.join(__dirname, "..", "shared", ".claude", "helpers", "claude-rules.cjs");
const { parse, load, appliesTo } = require(HELPER);

function proyecto(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-rules-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}

test("una regla sin frontmatter aplica siempre y conserva su cuerpo", () => {
  assert.deepEqual(parse("# Regla\ntexto\n"), { paths: [], body: "# Regla\ntexto\n" });
});

test("lee paths como lista con guiones, entre comillas o no", () => {
  const r = parse('---\npaths:\n  - "apps/api/**"\n  - apps/worker/**\n---\n# Backend\n');
  assert.deepEqual(r.paths, ["apps/api/**", "apps/worker/**"]);
  assert.equal(r.body, "# Backend\n");
});

test("lee paths en línea, sueltos o como arreglo", () => {
  assert.deepEqual(parse('---\npaths: "src/**/*.ts"\n---\nx').paths, ["src/**/*.ts"]);
  assert.deepEqual(parse('---\npaths: ["a/**", "b/**"]\ndescription: otra\n---\nx').paths, ["a/**", "b/**"]);
});

test("otras claves del frontmatter no cuentan como paths", () => {
  assert.deepEqual(parse("---\ndescription: algo\ntags:\n  - x\n---\ncuerpo").paths, []);
});

test("load recorre .claude/rules/ completo, en orden, y marca cuáles aplican siempre", () => {
  const dir = proyecto({
    ".claude/rules/kit/backend.md": '---\npaths:\n  - "apps/api/**"\n---\n# Backend\n',
    ".claude/rules/kit/frontend.md": "# Frontend siempre\n",
    ".claude/rules/equipo.md": "# Nuestra regla\n",
    ".claude/rules/notas.txt": "no es regla",
  });
  const reglas = load(dir);
  assert.deepEqual(reglas.map((r) => [r.rel, r.always]), [
    [".claude/rules/equipo.md", true],
    [".claude/rules/kit/backend.md", false],
    [".claude/rules/kit/frontend.md", true],
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("sin .claude/rules/ no hay reglas; como CLI lo dice", () => {
  const dir = proyecto({ "README.md": "x" });
  assert.deepEqual(load(dir), []);
  const r = spawnSync("node", [HELPER], { encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
  assert.match(r.stdout, /No hay reglas/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("appliesTo: las reglas con paths: solo tocan los archivos de su carpeta", () => {
  const api = { always: false, paths: ["apps/api/**"] };
  assert.ok(appliesTo(api, "/repo/apps/api/src/users.service.ts", "/repo"));
  assert.ok(appliesTo(api, "apps/api/main.ts", "/repo"), "también con rutas relativas");
  assert.ok(!appliesTo(api, "/repo/apps/web/app/page.tsx", "/repo"));
  assert.ok(!appliesTo(api, "/otro/apps/api/x.ts", "/repo"), "fuera del proyecto, nunca");
  assert.ok(appliesTo({ always: true, paths: [] }, "/repo/cualquier.md", "/repo"));
});

test("appliesTo: globs de extensión y carpetas con caracteres escapados", () => {
  assert.ok(appliesTo({ always: false, paths: ["**/*.ts"] }, "/r/a/b/c.ts", "/r"));
  assert.ok(!appliesTo({ always: false, paths: ["**/*.ts"] }, "/r/a/b/c.tsx", "/r"));
  assert.ok(appliesTo({ always: false, paths: ["apps/\\[web\\]/**"] }, "/r/apps/[web]/x.ts", "/r"));
});
