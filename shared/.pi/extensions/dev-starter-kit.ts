// Dev Starter Kit para Pi Agent. Pi lee CLAUDE.md, pero no resuelve sus @imports, no carga
// .claude/rules/, no corre los hooks de Claude Code ni tiene sistema de permisos. Esta extensión
// cubre eso con los mismos helpers del kit:
//  - contexto: expande los imports de CLAUDE.md (claude-imports.cjs), añade las reglas de
//    .claude/rules/ que Claude carga siempre, las que no tienen `paths:` (claude-rules.cjs), y los
//    avisos del inicio de sesión (hook-handler.cjs session-start). Las reglas con `paths:` (un
//    stack por carpeta en monorepo) se anexan, como en Claude, la primera vez que se lee o edita
//    un archivo de su carpeta, y otra vez tras compactar;
//  - guardrails: antes de cada herramienta, las mismas reglas que los hooks PreToolUse de Claude
//    (hook-handler.cjs) y las reglas deny/ask de .claude/settings.json (claude-permissions.cjs).
//    Lo que pide aprobación se confirma con la persona y, sin interfaz (pi -p), se bloquea.
//    Una herramienta que el kit no conoce (MCP, otra extensión) se confirma una vez por sesión;
//  - /loop-task: la puerta del ciclo (loop.cjs gate --approval) corre al cerrar cada turno, como
//    el hook Stop de Claude. Si el verificador falla, Pi sigue con el error a la vista; con el
//    verificador en verde y el resumen escrito, el cierre lo aprueba la persona (Pi no tiene
//    subagentes para la revisión independiente). Sin interfaz, el ciclo queda esperándola.
// Son guardrails, no aislamiento: Pi corre con los permisos de tu usuario. Para garantías
// reales, un contenedor o una VM.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { expand } = require("../../.claude/helpers/claude-imports.cjs");
const rules = require("../../.claude/helpers/claude-rules.cjs");
const permissions = require("../../.claude/helpers/claude-permissions.cjs");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HOOKS = path.join(ROOT, ".claude", "helpers", "hook-handler.cjs");
const LOOP = path.join(ROOT, ".claude", "helpers", "loop.cjs");
const LOOP_STATE = path.join(ROOT, ".claude", "loop", "state.json");
const ENV = { ...process.env, CLAUDE_PROJECT_DIR: ROOT, PI_CODING_AGENT: "true" };
const KNOWN = new Set(["read", "bash", "edit", "write", "grep", "find", "ls", "powershell"]);

type Input = Record<string, any>;
type Veredicto = { block?: string; ask?: string; context?: string };

// Corre una acción de hook-handler.cjs con el payload que le mandaría Claude Code.
function hook(action: string, toolInput: Input, source = "startup"): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync("node", [HOOKS, action], {
    input: JSON.stringify({ tool_input: toolInput, source }),
    encoding: "utf8",
    env: ENV,
  });
  return { code: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}

// loop.cjs sin bloquear la interfaz: el verificador (tests, build) puede tardar minutos.
function loop(args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn("node", [LOOP, ...args], { cwd: ROOT, env: ENV });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.on("close", () => resolve(out.trim()));
    p.on("error", () => resolve(""));
    p.stdin.end("{}");
  });
}

// Las salidas de PreToolUse en Claude: exit 2 (bloquea con stderr), permissionDecision deny o
// ask, y additionalContext.
function preToolUse(action: string, toolInput: Input): Veredicto {
  const r = hook(action, toolInput);
  if (r.code === 2) return { block: r.stderr.trim() || "Bloqueado por el kit." };
  let out: Input | undefined;
  try {
    out = JSON.parse(r.stdout.trim() || "null")?.hookSpecificOutput;
  } catch (_) {
    return {};
  }
  if (!out) return {};
  if (out.permissionDecision === "deny") return { block: out.permissionDecisionReason };
  if (out.permissionDecision === "ask") return { ask: out.permissionDecisionReason };
  return out.additionalContext ? { context: out.additionalContext } : {};
}

// Herramienta de Pi → acción del hook-handler y payload con la forma de Claude Code.
function comoClaude(tool: string, input: Input, cwd: string): [string, Input] | null {
  const abs = (p: unknown) => {
    const s = p === undefined ? "." : String(p);
    return s.startsWith("~/") ? path.join(os.homedir(), s.slice(2)) : path.resolve(cwd, s);
  };
  if (tool === "bash" || tool === "powershell") return ["pre-bash", { command: input.command }];
  if (tool === "read" || tool === "grep" || tool === "find" || tool === "ls") return ["pre-read", { file_path: abs(input.path) }];
  if (tool === "write") return ["pre-edit", { file_path: abs(input.path), content: input.content }];
  // Pi manda edits[].newText; el hook-handler revisa edits[].new_string, como en MultiEdit de Claude.
  if (tool === "edit") return ["pre-edit", { file_path: abs(input.path), edits: (input.edits ?? []).map((e: Input) => ({ new_string: e.newText })) }];
  return null;
}

export default function (pi: ExtensionAPI) {
  let imports = new Map<string, { raw: string; expanded: string }>();
  let fijas: { path: string; content: string }[] = [];
  let porCarpeta: { file: string; rel: string; paths: string[]; body: string }[] = [];
  let anexadas = new Set<string>();
  let avisos = "";
  let reglas = { deny: [] as string[], ask: [] as string[] };
  let aprobadas = new Set<string>();
  const contexto = new Map<string, string>();

  const refrescar = (inicio: boolean) => {
    imports = new Map();
    const todas = rules.load(ROOT);
    fijas = todas.filter((r: { always: boolean }) => r.always).map((r: { file: string; body: string }) => ({ path: r.file, content: r.body }));
    porCarpeta = todas.filter((r: { always: boolean }) => !r.always);
    anexadas = new Set(); // tras compactar, las reglas por carpeta vuelven a anexarse
    reglas = permissions.load(ROOT);
    // Como el hook de Claude: los avisos solo al iniciar, no tras compactar (ya están en el resumen).
    avisos = inicio ? hook("session-start", {}).stdout.trim() : "";
  };

  pi.on("session_start", async (_event, ctx) => {
    refrescar(true);
    aprobadas = new Set();
    // Si la persona no ve este indicador, la capa del kit no está activa (proyecto sin confianza
    // o Pi corriendo con --no-extensions): ni contexto ni guardrails.
    if (ctx.hasUI) ctx.ui.setStatus("dev-starter-kit", "🧰 dev-kit");
  });

  pi.on("session_compact", async () => refrescar(false));

  pi.on("before_agent_start", async (event) => {
    const opts = event.systemPromptOptions;
    const files = (opts.contextFiles ??= []);
    for (const file of files) {
      if (path.basename(file.path).toLowerCase() !== "claude.md") continue;
      let hit = imports.get(file.path);
      if (hit && file.content === hit.expanded) continue;
      if (!hit || hit.raw !== file.content) {
        hit = { raw: file.content, expanded: expand(file.path, file.content) };
        imports.set(file.path, hit);
      }
      file.content = hit.expanded;
    }
    for (const regla of fijas) if (!files.some((f) => f.path === regla.path)) files.push(regla);
    if (opts.sections && avisos) opts.sections["dev-starter-kit"] = avisos;
  });

  // Corre también para las llamadas anidadas (p. ej. desde codemode).
  pi.on("tool_call", async (event, ctx) => {
    const input = event.input as Input;
    const claude = comoClaude(event.toolName, input, ctx.cwd);
    const v = claude ? preToolUse(claude[0], claude[1]) : {};
    if (v.block) return { block: true, reason: v.block };

    const d = permissions.decide(reglas, event.toolName, input, { root: ROOT, cwd: ctx.cwd, home: os.homedir() });
    if (d.decision === "deny") return { block: true, reason: `Denegado por .claude/settings.json (${d.rule}).` };

    const desconocida = !KNOWN.has(event.toolName) && !aprobadas.has(event.toolName);
    const pregunta =
      v.ask ||
      (d.decision === "ask" ? `Pide confirmación según .claude/settings.json (${d.rule}).` : "") ||
      (desconocida ? `La herramienta ${event.toolName} no es del kit (MCP u otra extensión) y corre con tus permisos. ¿La permites en esta sesión?` : "");
    if (pregunta) {
      if (!ctx.hasUI) return { block: true, reason: `Requiere aprobación y no hay interfaz para pedirla: ${pregunta}` };
      if (!(await ctx.ui.confirm("Dev Starter Kit", pregunta))) return { block: true, reason: "La persona no lo aprobó." };
      if (desconocida) aprobadas.add(event.toolName);
    }
    if (v.context) contexto.set(event.toolCallId, v.context);
  });

  // Lo que en Claude hace PostToolUse: el contexto que pidió el hook y el formateo tras editar.
  // Además, las reglas por carpeta del archivo que se acaba de leer o editar.
  pi.on("tool_result", async (event, ctx) => {
    const extra: string[] = [];
    const pedido = contexto.get(event.toolCallId);
    contexto.delete(event.toolCallId);
    if (pedido) extra.push(`ℹ️ ${pedido}`);
    const archivo = ["read", "write", "edit"].includes(event.toolName) && !event.isError && comoClaude(event.toolName, event.input as Input, ctx.cwd);
    if (archivo) {
      if (event.toolName !== "read") hook("post-edit", { file_path: archivo[1].file_path });
      for (const r of porCarpeta) {
        if (anexadas.has(r.file) || !rules.appliesTo(r, archivo[1].file_path, ROOT)) continue;
        anexadas.add(r.file);
        extra.push(`📏 Regla del proyecto para ${r.paths.join(", ")} (${r.rel}); aplícala a los archivos de esa carpeta:\n\n${r.body.trim()}`);
      }
    }
    if (extra.length) return { content: [...event.content, ...extra.map((text) => ({ type: "text" as const, text }))] };
  });

  // La puerta de /loop-task: el hook Stop de Claude, al cerrar cada turno.
  pi.on("agent_before_settle", async (event, ctx) => {
    if (!fs.existsSync(LOOP_STATE)) return;
    let out: Input | null = null;
    try {
      out = JSON.parse((await loop(["gate", "--approval"])) || "null");
    } catch (_) {
      return;
    }
    if (!out) return;
    const mensaje = (content: string, seguir: boolean) => ({
      entries: [...event.entries, { type: "custom_message" as const, customType: "loop-task", content, display: true }],
      continue: seguir,
    });
    if (out.decision === "block") return mensaje(out.reason, true);
    if (out.systemMessage) {
      if (ctx.hasUI) ctx.ui.notify(out.systemMessage, "info");
      return;
    }
    if (!out.approval) return;
    const { objective, turns, summary } = out.approval;
    if (!ctx.hasUI) {
      return mensaje(`El ciclo "${objective}" pasó el verificador en ${turns} turnos y espera la aprobación de la persona: en su terminal, node .claude/helpers/loop.cjs approve (o reject --reason "…"). No sigas trabajando en el ciclo.`, false);
    }
    if (await ctx.ui.confirm("Cerrar el ciclo", `"${objective}" pasó el verificador en ${turns} turnos.\n\nResumen:\n${summary}\n\nRevisa el diff. ¿Apruebas el cierre?`)) {
      ctx.ui.notify(await loop(["approve"]), "info");
      return;
    }
    const motivo = ((await ctx.ui.input("¿Qué falta para aprobarlo?", "el caso de error de…")) || "").trim() || "sin motivo";
    await loop(["reject", "--reason", motivo]);
    return mensaje(`La persona no aprobó el cierre del ciclo "${objective}": ${motivo}. El ciclo sigue activo: resuélvelo, actualiza el resumen y vuelve a terminar el turno.`, true);
  });
}
