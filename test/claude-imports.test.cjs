// Tests del helper que expande los @imports de CLAUDE.md para Pi Agent, sobre carpetas temporales.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const HELPER = path.join(__dirname, "..", "shared", ".claude", "helpers", "claude-imports.cjs");
const { expand, MAX_DEPTH } = require(HELPER);

// Crea los archivos indicados en una carpeta temporal y devuelve la carpeta.
function proyecto(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-imports-"));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  return dir;
}
const expandir = (dir, file = "CLAUDE.md", opts = {}) => expand(path.join(dir, file), fs.readFileSync(path.join(dir, file), "utf8"), { home: path.join(dir, "home"), ...opts });
const limpiar = (dir) => fs.rmSync(dir, { recursive: true, force: true });

test("una línea que solo es un import se sustituye por el archivo", () => {
  const dir = proyecto({ "CLAUDE.md": "# Proyecto\n@.claude/reglas.md\n@design.md\nfin\n", ".claude/reglas.md": "regla 1\n", "design.md": "# Diseño\n" });
  const out = expandir(dir);
  assert.doesNotMatch(out, /^@/m, "no quedan líneas de import");
  assert.match(out, /<!-- import: \.claude\/reglas\.md -->\nregla 1\n<!-- \/import: \.claude\/reglas\.md -->/);
  assert.match(out, /# Diseño/);
  assert.ok(out.indexOf("regla 1") < out.indexOf("# Diseño") && out.indexOf("# Diseño") < out.indexOf("fin"), "conserva el orden");
  limpiar(dir);
});

test("un import dentro de una frase conserva la frase y pone el archivo debajo", () => {
  const dir = proyecto({ "CLAUDE.md": "Lee @notas.md antes de empezar.\n", "notas.md": "nota\n" });
  const out = expandir(dir);
  assert.match(out, /^Lee @notas\.md antes de empezar\.\n<!-- import: notas\.md -->\nnota/);
  limpiar(dir);
});

test("la puntuación final no forma parte de la ruta", () => {
  const dir = proyecto({ "CLAUDE.md": "Ver @notas.md.\n", "notas.md": "nota\n" });
  assert.match(expandir(dir), /nota/);
  limpiar(dir);
});

test("la ruta es relativa al archivo que contiene el import", () => {
  const dir = proyecto({ "CLAUDE.md": "@docs/a.md\n", "docs/a.md": "@b.md\n", "docs/b.md": "soy b\n", "b.md": "b equivocado\n" });
  const out = expandir(dir);
  assert.match(out, /soy b/);
  assert.doesNotMatch(out, /b equivocado/);
  limpiar(dir);
});

test("un ciclo no se expande dos veces", () => {
  const dir = proyecto({ "CLAUDE.md": "@a.md\n", "a.md": "en a\n@b.md\n", "b.md": "en b\n@a.md\n" });
  const out = expandir(dir);
  assert.equal(out.split("en a").length - 1, 1);
  assert.match(out, /en b\n@a\.md/, "el import circular queda como texto");
  limpiar(dir);
});

test(`llega como máximo a ${MAX_DEPTH} saltos`, () => {
  const files = { "CLAUDE.md": "@n1.md\n" };
  for (let i = 1; i <= 7; i++) files[`n${i}.md`] = `nivel ${i}\n@n${i + 1}.md\n`;
  const dir = proyecto(files);
  const out = expandir(dir);
  assert.match(out, new RegExp(`nivel ${MAX_DEPTH}\\n@n${MAX_DEPTH + 1}\\.md`));
  assert.doesNotMatch(out, new RegExp(`nivel ${MAX_DEPTH + 1}`));
  limpiar(dir);
});

test("ignora los @ dentro de bloques y spans de código", () => {
  const dir = proyecto({ "CLAUDE.md": "```\n@notas.md\n```\nUsa `@notas.md` así.\n", "notas.md": "NO\n" });
  assert.doesNotMatch(expandir(dir), /NO/);
  limpiar(dir);
});

test("un import que no existe y los correos quedan como texto", () => {
  const dir = proyecto({ "CLAUDE.md": "@falta.md\nescribe a ana@ejemplo.com\n" });
  const raw = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  assert.equal(expandir(dir), raw);
  limpiar(dir);
});

test("nunca expande archivos de entorno reales ni ~/.ssh; los .example sí", () => {
  const dir = proyecto({
    "CLAUDE.md": "@.env\n@.env.local\n@.env.example\n@~/.ssh/id_rsa\n",
    ".env": "SECRETO=1\n",
    ".env.local": "SECRETO=2\n",
    ".env.example": "SECRETO=\n",
    "home/.ssh/id_rsa": "LLAVE\n",
  });
  const out = expandir(dir);
  assert.doesNotMatch(out, /SECRETO=[12]|LLAVE/);
  assert.match(out, /<!-- import: \.env\.example -->\nSECRETO=\n/);
  assert.match(out, /^@\.env$/m, "el import bloqueado queda como texto");
  limpiar(dir);
});

test("un archivo importado dos veces entra una sola vez", () => {
  const dir = proyecto({ "CLAUDE.md": "@notas.md\ntexto\n@notas.md\n", "notas.md": "nota\n" });
  const out = expandir(dir);
  assert.equal(out.split("nota\n").length - 1, 1);
  assert.doesNotMatch(out, /^@notas\.md$/m);
  limpiar(dir);
});

test("sin imports devuelve el texto igual (idempotente)", () => {
  const dir = proyecto({ "CLAUDE.md": "@design.md\n", "design.md": "# Diseño\n" });
  const una = expandir(dir);
  assert.equal(expand(path.join(dir, "CLAUDE.md"), una, { home: path.join(dir, "home") }), una);
  limpiar(dir);
});

test("como CLI imprime el CLAUDE.md expandido", () => {
  const dir = proyecto({ "CLAUDE.md": "@design.md\n", "design.md": "# Diseño\n" });
  const r = spawnSync("node", [HELPER], { cwd: dir, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /# Diseño/);
  limpiar(dir);
});
