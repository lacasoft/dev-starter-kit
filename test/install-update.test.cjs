// Tests de --update: lo delicado es que una actualización NO pierda nada del usuario.
// Son de integración (corren el instalador de verdad sobre un proyecto temporal) porque el
// valor está en el comportamiento conjunto manifiesto + merge, no en las funciones sueltas.
// Correr: `npm test` o `node --test`.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const INSTALL = path.join(__dirname, "..", "install.js");

function instalar(cwd, extra = []) {
  const r = spawnSync("node", [INSTALL, "--yes", "--stack", "backend/nestjs", "--no-external", ...extra], {
    cwd,
    input: "",
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `el instalador falló:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}
function proyecto() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-update-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","dependencies":{"@nestjs/core":"^10"}}');
  instalar(dir);
  return dir;
}
const leerJSON = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

test("la instalación deja un manifiesto con el hash de cada archivo", () => {
  const dir = proyecto();
  const m = leerJSON(path.join(dir, ".claude", ".kit-manifest.json"));
  assert.ok(m.version, "el manifiesto debe registrar la versión del kit");
  assert.ok(Object.keys(m.files).length > 20, "debe registrar todos los archivos de la capa base");
  assert.ok(m.files["settings.json"], "settings.json debe estar en el manifiesto");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update FUSIONA settings.json y conserva todo lo del usuario", () => {
  const dir = proyecto();
  const sp = path.join(dir, ".claude", "settings.json");
  const s = leerJSON(sp);
  s.permissions.allow.push("Bash(mi-comando-propio *)");
  s.permissions.deny.push("Bash(terraform destroy*)");
  s.env = { ...(s.env || {}), MI_VARIABLE: "valor-mio" };
  s.model = "opus"; // clave que el kit no conoce
  s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: "echo hook-mio", timeout: 3 }] });
  fs.writeFileSync(sp, JSON.stringify(s, null, 2));

  instalar(dir, ["--update"]);

  const out = leerJSON(sp);
  assert.ok(out.permissions.allow.includes("Bash(mi-comando-propio *)"), "tu permiso propio debe seguir");
  assert.ok(out.permissions.deny.includes("Bash(terraform destroy*)"), "tu deny propio debe seguir");
  assert.equal(out.env.MI_VARIABLE, "valor-mio", "tu env propia debe seguir");
  assert.equal(out.model, "opus", "las claves que el kit no conoce se conservan");
  assert.ok(JSON.stringify(out.hooks).includes("hook-mio"), "tu hook propio debe seguir");
  // ...y lo del kit sigue presente (no se perdió al fusionar)
  assert.ok(out.permissions.deny.includes("Bash(sudo *)"), "los permisos del kit deben seguir");
  assert.ok(JSON.stringify(out.hooks).includes("hook-handler.cjs"), "los hooks del kit deben seguir");
  assert.equal(new Set(out.permissions.allow).size, out.permissions.allow.length, "la unión no debe duplicar");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update respeta un archivo que editaste si el kit no lo cambió (sin ruido)", () => {
  const dir = proyecto();
  const agente = path.join(dir, ".claude", "agents", "coder.md");
  fs.appendFileSync(agente, "\n## MI SECCIÓN\n");

  instalar(dir, ["--update"]);

  assert.match(fs.readFileSync(agente, "utf8"), /MI SECCIÓN/, "tu edición no se pisa");
  assert.ok(!fs.existsSync(`${agente}.kit-new`), "no se genera .kit-new si el kit no cambió el archivo");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update conserva lo tuyo y deja la versión nueva como .kit-new cuando cambian ambos", () => {
  const dir = proyecto();
  const agente = path.join(dir, ".claude", "agents", "coder.md");
  const mp = path.join(dir, ".claude", ".kit-manifest.json");
  fs.appendFileSync(agente, "\n## MI SECCIÓN\n");
  // Manifiesto con un hash que no coincide ni con tu copia ni con la del kit: simula
  // "el kit también cambió este archivo" (y cubre el caso sin manifiesto previo fiable).
  const m = leerJSON(mp);
  m.files["agents/coder.md"] = "0".repeat(16);
  fs.writeFileSync(mp, JSON.stringify(m, null, 2));

  const salida = instalar(dir, ["--update"]);

  assert.match(fs.readFileSync(agente, "utf8"), /MI SECCIÓN/, "tu copia se conserva intacta");
  assert.ok(fs.existsSync(`${agente}.kit-new`), "la versión del kit queda al lado como .kit-new");
  assert.match(salida, /kit-new/, "el informe debe avisar del conflicto");
  assert.match(salida, /diff /, "el informe debe dar el comando para comparar");
  fs.rmSync(dir, { recursive: true, force: true });
});

// Ruflo (claude-flow) se retiró del kit. Lo que dejó en settings.json (los permisos y el env que
// ponía el kit, y los hooks de su `init`) se retira en --update; el resto solo se avisa.
test("--update retira de settings.json lo que apunta a Ruflo y conserva lo demás", () => {
  const dir = proyecto();
  const sp = path.join(dir, ".claude", "settings.json");
  const s = leerJSON(sp);
  s.permissions.allow.push("mcp__claude-flow__*", "Bash(npx claude-flow*)", "Bash(mi-comando-propio *)");
  s.env = { CLAUDE_FLOW_HOOKS_ENABLED: "true", MI_VARIABLE: "valor-mio" };
  s.claudeFlow = { topology: "hierarchical-mesh" };
  s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: "npx claude-flow@alpha hooks pre-command" }] });
  fs.writeFileSync(sp, JSON.stringify(s, null, 2));

  const salida = instalar(dir, ["--update"]);

  const out = leerJSON(sp);
  const texto = JSON.stringify(out);
  assert.doesNotMatch(texto, /claude-flow|claudeFlow|CLAUDE_FLOW/i, "no debe quedar nada de Ruflo");
  assert.ok(out.permissions.allow.includes("Bash(mi-comando-propio *)"), "tus permisos siguen");
  assert.equal(out.env.MI_VARIABLE, "valor-mio", "tu env sigue");
  assert.match(salida, /Retirado de settings\.json/, "el informe debe decir qué retiró");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("avisa de los restos de Ruflo sin borrarlos", () => {
  const dir = proyecto();
  fs.writeFileSync(path.join(dir, ".mcp.json"), JSON.stringify({ mcpServers: { "claude-flow": { command: "npx" }, otro: { command: "x" } } }));
  fs.mkdirSync(path.join(dir, ".claude-flow"));
  fs.mkdirSync(path.join(dir, ".claude", "agents", "core"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".claude", "agents", "core", "swarm.md"), "Usa mcp__claude-flow__swarm_init");

  const salida = instalar(dir);

  assert.match(salida, /Restos de Ruflo/);
  assert.match(salida, /servidor "claude-flow"/);
  assert.doesNotMatch(salida, /servidor "otro"/, "un servidor ajeno a Ruflo no se señala");
  assert.match(salida, /\.claude-flow\//);
  assert.match(salida, /agents\/core\/swarm\.md/);
  assert.ok(fs.existsSync(path.join(dir, ".claude-flow")), "no borra lo que no instaló el kit");
  assert.ok(fs.existsSync(path.join(dir, ".mcp.json")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("un proyecto sin Ruflo no recibe el aviso (los archivos del kit no cuentan)", () => {
  const dir = proyecto();
  assert.doesNotMatch(instalar(dir, ["--update"]), /Restos de Ruflo/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--no-flow se acepta, avisa y no rompe", () => {
  const dir = proyecto();
  assert.match(instalar(dir, ["--no-flow"]), /--no-flow ya no hace nada/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update nunca toca la memoria ni CLAUDE.project.md", () => {
  const dir = proyecto();
  const mem = path.join(dir, ".claude", "memory", "notas.md");
  fs.mkdirSync(path.dirname(mem), { recursive: true });
  fs.writeFileSync(mem, "recuerdo importante");
  fs.writeFileSync(path.join(dir, "CLAUDE.project.md"), "# contexto real del proyecto");

  instalar(dir, ["--update"]);

  assert.equal(fs.readFileSync(mem, "utf8"), "recuerdo importante");
  assert.equal(fs.readFileSync(path.join(dir, "CLAUDE.project.md"), "utf8"), "# contexto real del proyecto");
  fs.rmSync(dir, { recursive: true, force: true });
});
