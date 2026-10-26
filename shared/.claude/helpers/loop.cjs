#!/usr/bin/env node
/**
 * loop.cjs — ciclo de trabajo con verificador determinista (loop engineering), zero-dep.
 *
 *   node .claude/helpers/loop.cjs start --check "<comando>" [--max-turns 10] [--objective "…"]
 *   node .claude/helpers/loop.cjs status
 *   node .claude/helpers/loop.cjs stop
 *   node .claude/helpers/loop.cjs gate        ← hook Stop (lo llama Claude Code, no la persona)
 *
 * La idea: Claude no decide cuándo terminó. Al final de cada turno, el hook Stop corre el
 * verificador (tests, lint, build). Si falla, Claude sigue con el error a la vista; si pasa,
 * se exige una revisión independiente antes de cerrar; si se agota el tope de turnos, para y
 * deja el informe.
 *
 * Dos lugares, a propósito:
 *  - .claude/loop/state.json — el contrato (verificador, tope, turnos). Solo lo escribe este helper;
 *    Claude Code protege .claude/ de las ediciones del agente y los hooks del kit también.
 *  - .loop/PROGRESS.md — el progreso, que Claude sí escribe (notas y resumen final).
 * Ambos gitignorados.
 */
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, "..", "..");
const DIR = path.join(ROOT, ".claude", "loop");
const STATE = path.join(DIR, "state.json");
const PROGRESS_DIR = path.join(ROOT, ".loop");
const PROGRESS = path.join(PROGRESS_DIR, "PROGRESS.md");
const DEFAULT_MAX_TURNS = 10;
const HARD_MAX_TURNS = 50;
const CHECK_TIMEOUT_MS = 10 * 60 * 1000; // el hook Stop tiene 15 min en settings.json

// El hook ejecuta el verificador sin pasar por los permisos de Claude Code, así que solo admite
// comandos de verificación del propio proyecto: tests, lint, typecheck y build. Nada de shell
// arbitrario: sin ; | > < $ ` ni subshells; los pasos se encadenan solo con &&.
const ARGS = "(?: [\\w./:=@,+-]+)*";
const ALLOWED_STEPS = [
  new RegExp(`^(?:npm|pnpm|yarn|bun) (?:test|run [\\w:.-]+)(?: --${ARGS})?$`),
  new RegExp(`^npx --no-install (?:tsc|eslint|vitest|jest|prettier|biome|playwright)${ARGS}$`),
  new RegExp(`^node --test${ARGS}$`),
  new RegExp(`^(?:python3? -m )?(?:pytest|mypy|ruff check|ruff format --check)${ARGS}$`),
  new RegExp(`^(?:go (?:test|vet|build)|cargo (?:test|clippy|build)|dotnet (?:test|build))${ARGS}$`),
  new RegExp(`^(?:mvn|\\./mvnw)(?: -q)? (?:test|verify)${ARGS}$`),
  new RegExp(`^(?:gradle|\\./gradlew) (?:test|check|build)${ARGS}$`),
  new RegExp(`^(?:flutter (?:test|analyze)|dart (?:test|analyze))${ARGS}$`),
  new RegExp(`^(?:forge (?:test|build)|composer (?:test|run [\\w:.-]+)|vendor/bin/(?:phpunit|phpstan|pest)(?: analyse)?)${ARGS}$`),
  new RegExp(`^(?:git diff --exit-code|git diff --check)${ARGS}$`),
];

function validateCheck(check) {
  if (!check || !check.trim()) return "falta --check: el ciclo necesita un verificador";
  if (/[;|><$`(){}\\\n]/.test(check.replace(/&&/g, ""))) return "solo se admite && entre pasos; nada de ; | > < $ ` ni subshells";
  const steps = check.split("&&").map((s) => s.trim());
  const bad = steps.filter((s) => !ALLOWED_STEPS.some((re) => re.test(s)));
  if (bad.length) return `paso no permitido como verificador: ${bad.join(" · ")} (solo test, lint, typecheck o build del proyecto)`;
  return null;
}

function read() {
  try {
    return JSON.parse(fs.readFileSync(STATE, "utf8"));
  } catch (_) {
    return null;
  }
}
function write(state) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + "\n");
}
function appendProgress(text) {
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  fs.appendFileSync(PROGRESS, text);
}

// Corre cada paso en orden y para en el primero que falla.
function runCheck(check) {
  const started = Date.now();
  for (const step of check.split("&&").map((s) => s.trim())) {
    try {
      execSync(step, { cwd: ROOT, stdio: "pipe", timeout: CHECK_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CI: "1" } });
    } catch (e) {
      const out = `${e.stdout || ""}${e.stderr || ""}`.trim().split("\n");
      return { ok: false, step, code: e.status ?? "timeout", tail: out.slice(-40).join("\n").slice(-4000), ms: Date.now() - started };
    }
  }
  return { ok: true, ms: Date.now() - started };
}

// Huella de los scripts de package.json que usa el verificador. Un ciclo que "pasa" porque
// alguien cambió "test" por "exit 0" no pasó: lo detecta la puerta.
function scriptsFingerprint(check) {
  let scripts = {};
  try {
    scripts = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts || {};
  } catch (_) {
    return {};
  }
  const used = {};
  for (const step of check.split("&&").map((x) => x.trim())) {
    const m = step.match(/^(?:npm|pnpm|yarn|bun) (?:run )?([\w:.-]+)/);
    if (m && scripts[m[1]] !== undefined) used[m[1]] = scripts[m[1]];
  }
  return used;
}

function branch() {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch (_) {
    return null;
  }
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : undefined;
}
const flag = (name) => process.argv.includes(`--${name}`);

function start() {
  const check = arg("check");
  const problem = validateCheck(check);
  if (problem) return fail(`❌ ${problem}.`);
  const prev = read();
  if (prev && ["active", "reviewing"].includes(prev.status)) return fail(`❌ Ya hay un ciclo ${prev.status}: "${prev.objective}". Ciérralo con \`loop.cjs stop\`.`);
  const current = branch();
  if (["main", "master", "develop"].includes(current)) {
    return fail(`❌ Estás en ${current}. Un ciclo autónomo trabaja en una rama o worktree propio (skill git-worktrees), nunca en la rama principal.`);
  }
  const maxTurns = Math.min(Number(arg("max-turns")) || DEFAULT_MAX_TURNS, HARD_MAX_TURNS);
  // Verificar al verificador: si ya pasa antes de empezar, no mide lo que se quiere lograr.
  const baseline = runCheck(check);
  if (baseline.ok && !flag("allow-passing")) {
    return fail("❌ El verificador ya pasa antes de empezar: así no puede decir cuándo terminaste. Escribe primero el test que falla (skill tdd) o ajusta --check. Si es intencional (p. ej. un refactor que debe mantenerlo en verde), usa --allow-passing.");
  }
  const objective = arg("objective") || "(sin objetivo declarado)";
  write({ status: "active", objective, check, maxTurns, turns: 0, branch: current, scripts: scriptsFingerprint(check), startedAt: new Date().toISOString() });
  fs.mkdirSync(PROGRESS_DIR, { recursive: true });
  fs.writeFileSync(
    PROGRESS,
    `# Ciclo: ${objective}\n\n- Verificador: \`${check}\`\n- Tope: ${maxTurns} turnos · rama: ${current || "?"}\n- Inicio: ${new Date().toISOString()}\n\n` +
      `## Línea base\n${baseline.ok ? "✓ pasa (--allow-passing)" : `✗ \`${baseline.step}\` (exit ${baseline.code})\n\n\`\`\`\n${baseline.tail}\n\`\`\``}\n\n` +
      "## Notas de Claude\n<!-- Qué intentaste, qué descartaste y por qué. El helper añade abajo el resultado de cada turno. -->\n\n## Turnos\n"
  );
  console.log(`✅ Ciclo activo: "${objective}" · verificador \`${check}\` · tope ${maxTurns} turnos.`);
  console.log("   Al terminar cada turno, el hook Stop corre el verificador. Progreso: .loop/PROGRESS.md");
}

function status() {
  const s = read();
  if (!s) return console.log("No hay ciclo.");
  console.log(`${s.status} · "${s.objective}" · turno ${s.turns}/${s.maxTurns} · verificador \`${s.check}\`${s.finishedAt ? ` · terminó ${s.finishedAt}` : ""}`);
}

function stop() {
  const s = read();
  if (!s || !["active", "reviewing"].includes(s.status)) return console.log("No hay ciclo activo.");
  write({ ...s, status: "stopped", finishedAt: new Date().toISOString() });
  appendProgress(`\n**Detenido a mano en el turno ${s.turns}.**\n`);
  console.log("⏹️  Ciclo detenido.");
}

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: "block", reason }));
}

// Hook Stop. Sin ciclo activo no hace nada (y no cuesta nada).
function gate() {
  try {
    fs.readFileSync(0, "utf8");
  } catch (_) {}
  const s = read();
  if (!s || !["active", "reviewing"].includes(s.status)) return;
  const turns = s.turns + 1;
  const changed = Object.entries(s.scripts || {}).filter(([k, v]) => scriptsFingerprint(s.check)[k] !== v).map(([k]) => k);
  if (changed.length) {
    write({ ...s, turns });
    appendProgress(`- Turno ${turns} · ✗ el verificador cambió (scripts: ${changed.join(", ")})\n`);
    block(
      `Ciclo "${s.objective}": cambiaste el verificador (package.json → scripts.${changed.join(", scripts.")}). ` +
        "Un verificador modificado no cuenta. Restáuralo como estaba al empezar y resuelve la causa real; si el script de verdad estaba mal, dilo, detén el ciclo (loop.cjs stop) y que la persona decida."
    );
    return;
  }
  const result = runCheck(s.check);
  const stamp = new Date().toISOString();
  appendProgress(
    result.ok
      ? `- Turno ${turns} · ✓ verificador en verde (${Math.round(result.ms / 1000)} s)\n`
      : `- Turno ${turns} · ✗ \`${result.step}\` (exit ${result.code})\n`
  );

  if (!result.ok) {
    if (turns >= s.maxTurns) {
      write({ ...s, turns, status: "exhausted", finishedAt: stamp });
      appendProgress(`\n**Tope de ${s.maxTurns} turnos alcanzado sin pasar el verificador.**\n`);
      process.stdout.write(
        JSON.stringify({ systemMessage: `⛔ Ciclo detenido: ${s.maxTurns} turnos sin pasar \`${s.check}\`. Revisa .loop/PROGRESS.md antes de seguir.` })
      );
      return;
    }
    write({ ...s, turns, status: "active" });
    block(
      `Ciclo "${s.objective}" — turno ${turns}/${s.maxTurns}: el verificador falla.\n` +
        `Paso: ${result.step} (exit ${result.code})\n\n${result.tail}\n\n` +
        "Corrige la causa (no el test, salvo que el test esté mal y lo justifiques), anota en .loop/PROGRESS.md qué intentaste y vuelve a terminar el turno."
    );
    return;
  }

  if (s.status === "active") {
    // En verde. Antes de cerrar, quien revisa no puede ser quien hizo el trabajo.
    write({ ...s, turns, status: "reviewing" });
    block(
      `Ciclo "${s.objective}": el verificador pasa (turno ${turns}). Último paso antes de cerrar:\n` +
        "1. Lanza el agente `reviewer` sobre el diff completo del ciclo (git diff contra el punto de partida) y corrige lo CRITICAL o HIGH.\n" +
        "2. Añade al final de .loop/PROGRESS.md la sección \"## Resumen para la persona\": qué cambió, por qué, y qué debería revisar ella con atención.\n" +
        "No amplíes el alcance. Al terminar, el verificador corre otra vez."
    );
    return;
  }

  let progress = "";
  try {
    progress = fs.readFileSync(PROGRESS, "utf8");
  } catch (_) {}
  if (!/^## Resumen para la persona/m.test(progress)) {
    write({ ...s, turns });
    block(
      `Ciclo "${s.objective}": falta el cierre. Lanza el agente \`reviewer\` sobre el diff si no lo hiciste, y añade a .loop/PROGRESS.md la sección "## Resumen para la persona" (qué cambió, por qué y qué revisar con atención).`
    );
    return;
  }
  write({ ...s, turns, status: "passed", finishedAt: stamp });
  appendProgress(`\n**Ciclo cerrado en ${turns} turnos: verificador en verde y revisión hecha.**\n`);
  process.stdout.write(
    JSON.stringify({ systemMessage: `✅ Ciclo "${s.objective}" cerrado en ${turns} turnos. Revisa el diff y .loop/PROGRESS.md antes de hacer merge.` })
  );
}

function fail(msg) {
  console.error(msg);
  process.exitCode = 1;
}

if (require.main === module) {
  const action = process.argv[2];
  if (action === "start") start();
  else if (action === "status") status();
  else if (action === "stop") stop();
  else if (action === "gate") gate();
  else fail("Uso: loop.cjs start --check \"<comando>\" [--max-turns N] [--objective \"…\"] | status | stop | gate");
}

module.exports = { validateCheck };
