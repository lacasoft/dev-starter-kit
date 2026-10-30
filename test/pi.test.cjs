// Integración con Pi Agent real, sin modelo: el proveedor simulado de Pi ejecuta pasos guionizados
// y el arnés guarda el prompt de sistema, el primer mensaje, las herramientas activas y el
// resultado de cada llamada. Corre solo si PI_BIN apunta al binario de Pi (la CI instala 1.4.0).
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PI = process.env.PI_BIN;
const skip = PI ? false : "define PI_BIN con la ruta al binario de Pi para correr estas pruebas";
const INSTALL = path.join(__dirname, "..", "install.js");
// Arnés que Pi carga con -e. Va como texto porque Node trata los .ts de test/ como pruebas.
// HARNESS_STEPS: [{tool, args} | {text}]. Guarda system.txt, user.txt, tools.json y log.json en HARNESS_OUT.
const HARNESS = `
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

export default function (pi: ExtensionAPI) {
  const out = process.env.HARNESS_OUT ?? ".";
  const steps = JSON.parse(process.env.HARNESS_STEPS ?? '[{"text":"ok"}]');
  const log: unknown[] = [];
  const texto = (m: any) => (typeof m.content === "string" ? m.content : m.content.map((c: any) => c.text ?? "").join(""));
  const faux = fauxProvider();
  faux.setResponses(steps.map((step: any, i: number) => (context: any) => {
    if (i === 0) {
      fs.writeFileSync(path.join(out, "system.txt"), getCurrentSystemPrompt(context.messages));
      fs.writeFileSync(path.join(out, "user.txt"), texto(context.messages.find((m: any) => m.role === "user")));
      fs.writeFileSync(path.join(out, "tools.json"), JSON.stringify(getCurrentTools(context.messages).map((t: any) => t.name)));
    }
    const last = context.messages[context.messages.length - 1];
    if (last?.role === "toolResult") log.push({ tool: last.toolName, error: Boolean(last.isError), text: texto(last) });
    // Un mensaje de la extensión (p. ej. la puerta del ciclo) llega como mensaje de usuario.
    else if (i > 0 && last?.role === "user") log.push({ tool: "mensaje", error: false, text: texto(last) });
    fs.writeFileSync(path.join(out, "log.json"), JSON.stringify(log));
    return fauxAssistantMessage(step.tool ? fauxToolCall(step.tool, step.args ?? {}) : fauxText(step.text ?? "ok"));
  }));
  pi.registerProvider(faux.provider);
  // Una herramienta que el kit no conoce, como la de un servidor MCP u otra extensión.
  pi.registerTool({ name: "eco", label: "eco", description: "Repite un texto", parameters: Type.Object({}), async execute() {
    return { content: [{ type: "text", text: "eco" }], details: {} };
  } });
}
`;

// Instala el kit en un proyecto NestJS temporal y corre Pi una vez con los pasos dados.
function correrPi({ install = ["--stack", "backend/nestjs", "--pi"], prompt = "hola", piArgs = [], steps = [{ text: "ok" }], antes, home } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-pi-"));
  const agente = path.join(os.tmpdir(), `kit-pi-agente-${path.basename(dir)}`);
  fs.mkdirSync(agente);
  // Configuración de Pi aislada: confía en la carpeta de prueba y no envía telemetría.
  fs.writeFileSync(path.join(agente, "settings.json"), JSON.stringify({ defaultProjectTrust: "always", enableInstallTelemetry: false }));
  fs.writeFileSync(path.join(agente, "harness.ts"), HARNESS);
  fs.writeFileSync(path.join(dir, "package.json"), '{"name":"x","dependencies":{"@nestjs/core":"^10"}}');
  const inst = spawnSync("node", [INSTALL, "--yes", "--no-external", ...install], { cwd: dir, input: "", encoding: "utf8" });
  assert.equal(inst.status, 0, inst.stdout + inst.stderr);
  if (antes) antes(dir);
  const r = spawnSync(PI, ["-e", path.join(agente, "harness.ts"), "--provider", "faux", "--model", "faux-1", "--no-session", ...piArgs, "-p", prompt], {
    cwd: dir,
    input: "",
    encoding: "utf8",
    timeout: 60000,
    env: { ...process.env, ...(home ? { HOME: home } : {}), PI_CODING_AGENT_DIR: agente, HARNESS_OUT: agente, HARNESS_STEPS: JSON.stringify(steps), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", PI_TELEMETRY: "0" },
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const leer = (f) => fs.readFileSync(path.join(agente, f), "utf8");
  const res = { prompt: leer("system.txt"), user: leer("user.txt"), tools: JSON.parse(leer("tools.json")), log: JSON.parse(leer("log.json")), dir };
  fs.rmSync(agente, { recursive: true, force: true });
  return res;
}
const limpiar = (res) => fs.rmSync(res.dir, { recursive: true, force: true });

test("con --pi, Pi ve la baseline, el proyecto y las reglas del stack, y carga las skills", { skip }, () => {
  const res = correrPi();
  assert.match(res.prompt, /## 3\. Coordinación de agentes/, "contenido de .claude/CLAUDE.base.md");
  assert.match(res.prompt, /# Stack: NestJS/, "regla del stack sin paths: entra siempre");
  assert.doesNotMatch(res.prompt, /^@(CLAUDE\.project|\.claude\/CLAUDE\.base)\.md$/m, "no quedan líneas de import");
  for (const s of ["project-context", "tdd", "owasp-review", "loop-task"]) assert.match(res.prompt, new RegExp(`<name>${s}</name>`));
  assert.match(res.prompt, /<dev-starter-kit>[\s\S]*\/skill:project-context[\s\S]*<\/dev-starter-kit>/, "avisos de inicio con sintaxis de Pi");
  limpiar(res);
});

test("/status expande el comando kit/status de .claude/commands", { skip }, () => {
  const res = correrPi({ prompt: "/status" });
  assert.match(res.user, /Reporta de forma concisa/);
  limpiar(res);
});

test("en monorepo, cada regla entra al tocar un archivo de su carpeta, una sola vez", { skip }, () => {
  const api = { tool: "read", args: { path: "apps/api/src/users.service.ts" } };
  const res = correrPi({
    install: ["--stack", "backend/nestjs:apps/api,frontend/nextjs:apps/web", "--pi"],
    steps: [api, { tool: "read", args: { path: "apps/web/app/page.tsx" } }, api, { text: "ok" }],
    antes: (dir) => {
      for (const [f, c] of [["apps/api/src/users.service.ts", "export class UsersService {}\n"], ["apps/web/app/page.tsx", "export default function Page() { return null; }\n"]]) {
        fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
        fs.writeFileSync(path.join(dir, f), c);
      }
    },
  });
  assert.doesNotMatch(res.prompt, /# Stack: NestJS|# Stack: Next\.js/, "no entran siempre");
  assert.match(res.prompt, /## 3\. Coordinación de agentes/);
  assert.match(res.log[0].text, /# Stack: NestJS/);
  assert.doesNotMatch(res.log[0].text, /Next\.js/, "sin contaminación entre stacks");
  assert.match(res.log[1].text, /# Stack: Next\.js/);
  assert.doesNotMatch(res.log[1].text, /NestJS/);
  assert.doesNotMatch(res.log[2].text, /Regla del proyecto/, "la regla ya estaba en el contexto");
  limpiar(res);
});

test("sin --pi, Pi ve las líneas @ sin expandir y no carga las skills", { skip }, () => {
  const res = correrPi({ install: ["--stack", "backend/nestjs"] });
  assert.match(res.prompt, /^@\.claude\/CLAUDE\.base\.md$/m);
  assert.doesNotMatch(res.prompt, /<name>tdd<\/name>/);
  limpiar(res);
});

test("los guardrails del kit funcionan en Pi: hook-handler, settings.json y herramientas desconocidas", { skip }, () => {
  // HOME falso: la prueba de ~/.ssh nunca toca tus llaves reales.
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kit-pi-home-"));
  fs.mkdirSync(path.join(home, ".ssh"));
  fs.writeFileSync(path.join(home, ".ssh", "id_rsa"), "LLAVE-FALSA\n");
  const secreto = "'AKIA" + "QWERTYUIOPASDFGH'";
  const pasos = [
    ["read .env", { tool: "read", args: { path: ".env" } }, true, /Lectura bloqueada/],
    ["read .env.example", { tool: "read", args: { path: ".env.example" } }, false],
    ["grep sobre .env desde bash", { tool: "bash", args: { command: "grep SECRETO .env" } }, true, /Lectura bloqueada/],
    ["push --force", { tool: "bash", args: { command: "git push --force origin main" } }, true, /push --force a rama protegida/],
    ["sudo", { tool: "bash", args: { command: "sudo ls" } }, true, /sudo/],
    ["instalar sin interfaz", { tool: "bash", args: { command: "npm install left-pad@1.3.0 --dry-run" } }, true, /Requiere aprobación y no hay interfaz/],
    ["write con secreto", { tool: "write", args: { path: "secreto.ts", content: `const k = ${secreto};\n` } }, true, /Posible secreto/],
    ["edit con secreto", { tool: "edit", args: { path: "src/app.ts", edits: [{ oldText: "1", newText: secreto }] } }, true, /Posible secreto/],
    ["read ~/.ssh", { tool: "read", args: { path: "~/.ssh/id_rsa" } }, true, /settings\.json \(Read\(~\/\.ssh\/\*\*\)\)/],
    ["regla local del equipo", { tool: "bash", args: { command: "terraform destroy -auto-approve" } }, true, /terraform destroy/],
    ["herramienta desconocida", { tool: "eco", args: {} }, true, /eco no es del kit/],
    ["editar un .env de ejemplo", { tool: "write", args: { path: ".env.example", content: "X=\n" } }, false, /archivo de entorno/],
  ];
  const res = correrPi({
    home,
    steps: [...pasos.map((p) => p[1]), { text: "fin" }],
    antes: (dir) => {
      fs.writeFileSync(path.join(dir, ".env"), "SECRETO=1\n");
      fs.mkdirSync(path.join(dir, "src"));
      fs.writeFileSync(path.join(dir, "src", "app.ts"), "export const x = 1;\n");
      fs.writeFileSync(path.join(dir, ".claude", "settings.local.json"), JSON.stringify({ permissions: { deny: ["Bash(terraform destroy*)"] } }));
    },
  });
  assert.equal(res.log.length, pasos.length);
  pasos.forEach(([nombre, , bloqueado, re], i) => {
    assert.equal(res.log[i].error, bloqueado, `${nombre}: ${res.log[i].text}`);
    if (re) assert.match(res.log[i].text, re, nombre);
  });
  assert.ok(res.log.every((l) => !/LLAVE-FALSA|SECRETO=1/.test(l.text)), "ningún secreto llegó al modelo");
  assert.ok(!fs.existsSync(path.join(res.dir, "secreto.ts")));
  assert.equal(fs.readFileSync(path.join(res.dir, "src", "app.ts"), "utf8"), "export const x = 1;\n");
  fs.rmSync(home, { recursive: true, force: true });
  limpiar(res);
});

// ---- /loop-task en Pi: la puerta corre al cerrar cada turno ----
function cicloEnPi(steps, maxTurns = 5) {
  return correrPi({
    steps,
    antes: (dir) => {
      const git = (...a) => spawnSync("git", a, { cwd: dir });
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x", scripts: { test: "node check.js" }, dependencies: { "@nestjs/core": "^10" } }));
      fs.writeFileSync(path.join(dir, "check.js"), "process.exit(require('fs').existsSync('ok.txt') ? 0 : 1);\n");
      git("init", "-q", "-b", "master");
      git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "--allow-empty", "-qm", "init");
      git("switch", "-q", "-c", "feat/ciclo");
      const r = spawnSync("node", [".claude/helpers/loop.cjs", "start", "--check", "npm test", "--max-turns", String(maxTurns), "--objective", "crear ok.txt"], { cwd: dir, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: dir } });
      assert.equal(r.status, 0, r.stderr);
    },
  });
}
const estadoCiclo = (res) => JSON.parse(fs.readFileSync(path.join(res.dir, ".claude", "loop", "state.json"), "utf8"));

test("loop-task en Pi: con el verificador en rojo sigue trabajando hasta el tope", { skip }, () => {
  const res = cicloEnPi([{ text: "listo" }, { text: "listo otra vez" }, { text: "fin" }], 2);
  assert.ok(res.log.some((l) => l.tool === "mensaje" && /turno 1\/2: el verificador falla/.test(l.text)), "el error del verificador llega al modelo");
  assert.equal(estadoCiclo(res).status, "exhausted");
  limpiar(res);
});

test("loop-task en Pi: en verde pide el resumen y, sin interfaz, espera la aprobación de la persona", { skip }, () => {
  const res = cicloEnPi([
    { tool: "write", args: { path: "ok.txt", content: "" } },
    { text: "listo" },
    { tool: "bash", args: { command: "printf '\\n## Resumen para la persona\\n- creé ok.txt\\n' >> .loop/PROGRESS.md" } },
    { text: "listo" },
    { text: "fin" },
  ]);
  assert.ok(res.log.some((l) => l.tool === "mensaje" && /la persona decide si aprueba el cierre/.test(l.text)), "pide el resumen sin subagente");
  const s = estadoCiclo(res);
  assert.equal(s.status, "awaiting-approval", "no se cierra solo");
  const aprobar = spawnSync("node", [".claude/helpers/loop.cjs", "approve"], { cwd: res.dir, encoding: "utf8", env: { ...process.env, CLAUDE_PROJECT_DIR: res.dir } });
  assert.equal(aprobar.status, 0, aprobar.stderr);
  assert.equal(estadoCiclo(res).status, "passed");
  limpiar(res);
});
