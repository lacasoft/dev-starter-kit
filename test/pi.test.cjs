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
    fs.writeFileSync(path.join(out, "log.json"), JSON.stringify(log));
    return fauxAssistantMessage(step.tool ? fauxToolCall(step.tool, step.args ?? {}) : fauxText(step.text ?? "ok"));
  }));
  pi.registerProvider(faux.provider);
}
`;

// Instala el kit en un proyecto NestJS temporal y corre Pi una vez con los pasos dados.
function correrPi({ install = ["--stack", "backend/nestjs", "--pi"], prompt = "hola", piArgs = [], steps = [{ text: "ok" }], antes } = {}) {
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
    env: { ...process.env, PI_CODING_AGENT_DIR: agente, HARNESS_OUT: agente, HARNESS_STEPS: JSON.stringify(steps), PI_OFFLINE: "1", PI_SKIP_VERSION_CHECK: "1", PI_TELEMETRY: "0" },
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

test("en monorepo, las reglas con paths: no entran siempre (todavía no se cargan por carpeta)", { skip }, () => {
  const res = correrPi({ install: ["--stack", "backend/nestjs:apps/api,frontend/nextjs:apps/web", "--pi"] });
  assert.doesNotMatch(res.prompt, /# Stack: NestJS|# Stack: Next\.js/);
  assert.match(res.prompt, /## 3\. Coordinación de agentes/);
  limpiar(res);
});

test("sin --pi, Pi ve las líneas @ sin expandir y no carga las skills", { skip }, () => {
  const res = correrPi({ install: ["--stack", "backend/nestjs"] });
  assert.match(res.prompt, /^@\.claude\/CLAUDE\.base\.md$/m);
  assert.doesNotMatch(res.prompt, /<name>tdd<\/name>/);
  limpiar(res);
});
