// Dev Starter Kit para Pi Agent. Pi lee CLAUDE.md, pero no resuelve sus @imports, no carga
// .claude/rules/ ni corre los hooks de Claude Code. Esta extensión cubre la base con los mismos
// helpers del kit:
//  - expande los imports de CLAUDE.md (claude-imports.cjs): CLAUDE.project.md y la baseline;
//  - añade las reglas de .claude/rules/ que Claude carga siempre, las que no tienen `paths:`
//    (claude-rules.cjs); las de un monorepo, por carpeta, todavía no;
//  - pone en el contexto los avisos del inicio de sesión (hook-handler.cjs session-start).
// Todo se calcula al iniciar, recargar o compactar la sesión y se reutiliza entre turnos, igual
// que Claude no relee CLAUDE.md a cada mensaje.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { expand } = require("../../.claude/helpers/claude-imports.cjs");
const rules = require("../../.claude/helpers/claude-rules.cjs");
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const HOOKS = path.join(ROOT, ".claude", "helpers", "hook-handler.cjs");

function avisosDeInicio(): string {
  const r = spawnSync("node", [HOOKS, "session-start"], {
    input: JSON.stringify({ source: "startup" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: ROOT, PI_CODING_AGENT: "true" },
  });
  return (r.stdout || "").trim();
}

export default function (pi: ExtensionAPI) {
  let imports = new Map<string, { raw: string; expanded: string }>();
  let fijas: { path: string; content: string }[] = [];
  let avisos = "";

  const refrescar = (inicio: boolean) => {
    imports = new Map();
    fijas = rules.load(ROOT).filter((r: { always: boolean }) => r.always).map((r: { file: string; body: string }) => ({ path: r.file, content: r.body }));
    // Como el hook de Claude: los avisos solo al iniciar, no tras compactar (ya están en el resumen).
    avisos = inicio ? avisosDeInicio() : "";
  };

  pi.on("session_start", async (_event, ctx) => {
    refrescar(true);
    // Si la persona no ve este indicador, la capa del kit no está activa (proyecto sin confianza
    // o Pi corriendo con --no-extensions).
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
}
