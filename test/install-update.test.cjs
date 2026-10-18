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
  s.enabledMcpjsonServers = ["claude-flow", "ruv-swarm", "github"];
  s.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: "npx claude-flow@alpha hooks pre-command" }] });
  fs.writeFileSync(sp, JSON.stringify(s, null, 2));

  const salida = instalar(dir, ["--update"]);

  const out = leerJSON(sp);
  const texto = JSON.stringify(out);
  assert.doesNotMatch(texto, /claude-flow|claudeFlow|CLAUDE_FLOW/i, "no debe quedar nada de Ruflo");
  assert.ok(out.permissions.allow.includes("Bash(mi-comando-propio *)"), "tus permisos siguen");
  assert.equal(out.env.MI_VARIABLE, "valor-mio", "tu env sigue");
  assert.deepEqual(out.enabledMcpjsonServers, ["github"], "los servidores MCP ajenos a Ruflo siguen habilitados");
  assert.match(salida, /Retirado de settings\.json/, "el informe debe decir qué retiró");
  assert.doesNotMatch(salida, /Restos de Ruflo/, "tras retirarlo, settings.json ya no cuenta como resto");
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

// La memoria propia de la 2.x (memory.cjs, session.cjs, auto-memory-hook.mjs) se retiró.
test("--update borra un archivo que el kit ya no distribuye si sigue intacto", () => {
  const dir = proyecto();
  const viejo = path.join(dir, ".claude", "helpers", "memory.cjs");
  fs.writeFileSync(viejo, "// helper de una versión anterior\n");
  const mp = path.join(dir, ".claude", ".kit-manifest.json");
  const m = leerJSON(mp);
  m.files["helpers/memory.cjs"] = require("node:crypto").createHash("sha256").update(fs.readFileSync(viejo)).digest("hex").slice(0, 16);
  fs.writeFileSync(mp, JSON.stringify(m, null, 2));

  const salida = instalar(dir, ["--update"]);

  assert.ok(!fs.existsSync(viejo), "el helper intacto se retira");
  assert.match(salida, /ya no lo usa/);
  assert.ok(!leerJSON(mp).files["helpers/memory.cjs"], "y sale del manifiesto");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update conserva un archivo retirado que editaste, y avisa", () => {
  const dir = proyecto();
  const viejo = path.join(dir, ".claude", "helpers", "session.cjs");
  fs.writeFileSync(viejo, "// lo edité yo\n");
  const mp = path.join(dir, ".claude", ".kit-manifest.json");
  const m = leerJSON(mp);
  m.files["helpers/session.cjs"] = "0".repeat(16);
  fs.writeFileSync(mp, JSON.stringify(m, null, 2));

  const salida = instalar(dir, ["--update"]);

  assert.ok(fs.existsSync(viejo), "lo editado no se borra");
  assert.match(salida, /ya no es parte del kit/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("sin manifiesto, un helper retirado se avisa pero no se borra", () => {
  const dir = proyecto();
  fs.rmSync(path.join(dir, ".claude", ".kit-manifest.json"));
  const viejo = path.join(dir, ".claude", "helpers", "auto-memory-hook.mjs");
  fs.writeFileSync(viejo, "// 2.0\n");

  const salida = instalar(dir, ["--update"]);

  assert.ok(fs.existsSync(viejo));
  assert.match(salida, /no hay manifiesto/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test(".gitignore ignora la memoria personal y deja versionada la de equipo", () => {
  const dir = proyecto();
  const gi = fs.readFileSync(path.join(dir, ".gitignore"), "utf8").split("\n");
  assert.ok(gi.includes(".claude/agent-memory-local/"));
  assert.ok(gi.includes("CLAUDE.local.md"));
  assert.ok(!gi.some((l) => l.trim() === ".claude/agent-memory/"), "la memoria de equipo se versiona");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("indica el plugin de code intelligence (LSP) del stack", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-lsp-"));
  const salida = instalar(dir);
  assert.match(salida, /typescript-lsp@claude-plugins-official/);
  assert.match(salida, /typescript-language-server/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- overlays del stack como reglas (.claude/rules/kit/) ----
function correr(cwd, args) {
  const r = spawnSync("node", [INSTALL, "--yes", "--no-external", ...args], { cwd, input: "", encoding: "utf8" });
  return { status: r.status, out: (r.stdout || "") + (r.stderr || "") };
}
const regla = (dir, nombre) => fs.readFileSync(path.join(dir, ".claude", "rules", "kit", nombre), "utf8");

test("un solo stack: el overlay va a .claude/rules/kit sin paths y CLAUDE.md solo importa", () => {
  const dir = proyecto();
  const md = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  assert.match(md, /@\.claude\/CLAUDE\.base\.md/);
  assert.doesNotMatch(md, /playbook senior/, "el overlay ya no va inline en CLAUDE.md");
  assert.match(regla(dir, "backend-nestjs.md"), /NestJS/);
  assert.match(regla(dir, "backend.md"), /BACKEND/);
  assert.doesNotMatch(regla(dir, "backend-nestjs.md"), /^---\npaths:/, "sin paths: se carga siempre, como antes");
  assert.ok(leerJSON(path.join(dir, ".claude", ".kit-manifest.json")).files["rules/kit/backend-nestjs.md"], "las reglas van en el manifiesto");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("monorepo: cada regla queda acotada a la carpeta de su stack", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-mono-"));
  for (const [f, c] of Object.entries({
    "package.json": '{"private":true,"workspaces":["apps/*"]}',
    "apps/api/package.json": '{"dependencies":{"@nestjs/core":"^11"}}',
    "apps/web/package.json": '{"dependencies":{"next":"15"}}',
    "apps/admin/package.json": '{"dependencies":{"next":"15"}}',
  })) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), c);
  }
  const r = correr(dir, []);
  assert.equal(r.status, 0, r.out);
  assert.match(regla(dir, "backend-nestjs.md"), /^---\npaths:\n  - "apps\/api\/\*\*"\n---/);
  const next = regla(dir, "frontend-nextjs.md");
  assert.match(next, /"apps\/web\/\*\*"/);
  assert.match(next, /"apps\/admin\/\*\*"/, "el mismo stack en dos carpetas comparte regla");
  assert.match(regla(dir, "frontend.md"), /paths:/, "el común de la categoría también va acotado");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--stack acepta varios stacks con carpeta", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-stackflag-"));
  const r = correr(dir, ["--stack", "backend/fastapi:services/api,mobile/flutter:app"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Stack indicado: backend\/fastapi \(services\/api\/\) · mobile\/flutter \(app\/\)/);
  assert.match(regla(dir, "backend-fastapi.md"), /"services\/api\/\*\*"/);
  assert.match(regla(dir, "mobile-flutter.md"), /"app\/\*\*"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--stack con un stack inválido en la lista sale con código 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-stackbad-"));
  const r = correr(dir, ["--stack", "backend/nestjs:api,frontend/vue:web"]);
  assert.equal(r.status, 1);
  assert.match(r.out, /frontend\/vue/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--update migra el overlay inline de una instalación anterior a reglas", () => {
  const dir = proyecto();
  const md = path.join(dir, "CLAUDE.md");
  // Así lo dejaba la 2.x: el overlay dentro del bloque gestionado, y notas propias fuera.
  fs.writeFileSync(
    md,
    "<!-- BEGIN dev-starter-kit overlay -->\n@.claude/CLAUDE.base.md\n\n# Categoría: BACKEND — playbook senior\n- regla vieja\n<!-- END dev-starter-kit overlay -->\n\n# Mis notas\n"
  );
  instalar(dir, ["--update"]);
  const nuevo = fs.readFileSync(md, "utf8");
  assert.doesNotMatch(nuevo, /playbook senior|regla vieja/, "el overlay sale del bloque");
  assert.match(nuevo, /# Mis notas/, "lo de fuera del bloque se conserva");
  assert.match(regla(dir, "backend.md"), /BACKEND/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("cambiar de stack retira la regla vieja intacta y respeta la que editaste", () => {
  const dir = proyecto(); // backend/nestjs
  fs.appendFileSync(path.join(dir, ".claude", "rules", "kit", "backend.md"), "\n- regla mía\n");
  const r = correr(dir, ["--stack", "backend/express", "--update"]);
  assert.equal(r.status, 0, r.out);
  assert.ok(!fs.existsSync(path.join(dir, ".claude", "rules", "kit", "backend-nestjs.md")), "la del stack anterior se retira");
  assert.match(regla(dir, "backend-express.md"), /Express/);
  assert.match(regla(dir, "backend.md"), /regla mía/, "tu edición del común se conserva");
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- proyecto Node creado desde cero (npm init + tsc --init) ----
// Salió de instalar el kit en un proyecto recién creado: el primer commit fallaba (lint-staged sin
// configuración), node_modules/ no estaba ignorado y los import no compilaban.
function nodeDesdeCero(archivos = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-node0-"));
  spawnSync("git", ["init", "-q"], { cwd: dir });
  for (const [f, c] of Object.entries({ "package.json": '{"name":"x","type":"commonjs"}', ...archivos })) {
    fs.writeFileSync(path.join(dir, f), c);
  }
  return dir;
}
const TSCONFIG_NUEVO = '{\n  "compilerOptions": {\n    // "rootDir": "./src",\n    "module": "nodenext",\n    "verbatimModuleSyntax": true,\n    "strict": true\n  }\n}\n';
// --all + --dry-run: recorre el flujo de husky sin instalar nada (la CI no depende de la red).
// Sin --no-external, que también se salta este paso.
const planHusky = (dir) =>
  spawnSync("node", [INSTALL, "--yes", "--stack", "backend/express", "--all", "--dry-run"], { cwd: dir, input: "", encoding: "utf8" }).stdout;

test("husky: lint-staged con tsc si hay tsconfig, y dependencias con versión exacta y cooldown", () => {
  const dir = nodeDesdeCero({ "tsconfig.json": TSCONFIG_NUEVO });
  const out = planHusky(dir);
  assert.match(out, /pre-commit: lint-staged → tsc --noEmit/);
  assert.match(out, /npm install -D -E --before=\d{4}-\d{2}-\d{2} husky lint-staged /, "-E y --before aplican §6.1 al propio kit");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("husky: sin nada que revisar no instala lint-staged (un pre-commit sin config bloquea todos los commits)", () => {
  const dir = nodeDesdeCero();
  const out = planHusky(dir);
  assert.match(out, /nada que revisar todavía/);
  assert.doesNotMatch(out, /npm install[^\n]*lint-staged/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("husky: respeta una configuración de lint-staged que ya existe", () => {
  const dir = nodeDesdeCero({ "package.json": '{"name":"x","lint-staged":{"*.js":"node --check"}}' });
  assert.match(planHusky(dir), /configuración que ya tiene el proyecto/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test(".gitignore añade node_modules/ en un proyecto Node", () => {
  const dir = proyecto();
  assert.ok(fs.readFileSync(path.join(dir, ".gitignore"), "utf8").split("\n").includes("node_modules/"));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("el resumen avisa si tsconfig y package.json no permiten import/export", () => {
  const conCommonjs = nodeDesdeCero({ "tsconfig.json": TSCONFIG_NUEVO });
  assert.match(correr(conCommonjs, ["--stack", "backend/express", "--dry-run"]).out, /Módulos\s+⚠️/);
  const conModule = nodeDesdeCero({ "package.json": '{"name":"x","type":"module"}', "tsconfig.json": TSCONFIG_NUEVO });
  assert.doesNotMatch(correr(conModule, ["--stack", "backend/express", "--dry-run"]).out, /Módulos/);
  fs.rmSync(conCommonjs, { recursive: true, force: true });
  fs.rmSync(conModule, { recursive: true, force: true });
});

// ---- --update recuerda el stack ----
// Un proyecto sin framework detectable (TypeScript puro) se instala con --stack; antes, cada
// --update --yes fallaba con "No se pudo detectar el stack" si no se repetía.
function sinFramework() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-sinfw-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x"}');
  return dir;
}

test("--update sin --stack reutiliza el stack de la instalación anterior", () => {
  const dir = sinFramework();
  assert.equal(correr(dir, ["--stack", "backend/express"]).status, 0);
  assert.deepEqual(leerJSON(path.join(dir, ".claude", ".kit-manifest.json")).stacks, [{ id: "backend/express", dirs: null }]);
  const r = correr(dir, ["--update"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /Stack de la instalación anterior: backend\/express/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("instalación 3.0.x sin stacks en el manifiesto: se deducen de .claude/rules/kit/", () => {
  const dir = sinFramework();
  correr(dir, ["--stack", "backend/express"]);
  const mp = path.join(dir, ".claude", ".kit-manifest.json");
  const m = leerJSON(mp);
  delete m.stacks; // así lo dejaban 3.0.0 y 3.0.1
  fs.writeFileSync(mp, JSON.stringify(m));
  const r = correr(dir, ["--update"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /instalación anterior: backend\/express/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("monorepo: --update conserva los stacks y sus carpetas sin repetir --stack", () => {
  const dir = sinFramework();
  correr(dir, ["--stack", "backend/nestjs:apps/api,frontend/nextjs:apps/web,frontend/nextjs:apps/admin"]);
  const mp = path.join(dir, ".claude", ".kit-manifest.json");
  const m = leerJSON(mp);
  delete m.stacks; // también desde las reglas (paths:)
  fs.writeFileSync(mp, JSON.stringify(m));
  const antes = regla(dir, "frontend-nextjs.md");
  const r = correr(dir, ["--update"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /backend\/nestjs \(apps\/api\/\)/);
  assert.equal(regla(dir, "frontend-nextjs.md"), antes, "las rutas de cada regla no cambian");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("--stack explícito gana sobre el stack recordado", () => {
  const dir = sinFramework();
  correr(dir, ["--stack", "backend/express"]);
  const r = correr(dir, ["--update", "--stack", "backend/fastapi"]);
  assert.match(r.out, /Stack indicado: backend\/fastapi/);
  assert.deepEqual(leerJSON(path.join(dir, ".claude", ".kit-manifest.json")).stacks, [{ id: "backend/fastapi", dirs: null }]);
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
