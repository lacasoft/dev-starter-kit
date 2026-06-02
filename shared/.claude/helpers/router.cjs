// Routing por palabras clave: sugiere el agente core más apropiado para un prompt.
const RULES = [
  { re: /\b(test|spec|cobertura|coverage|jest|vitest|pytest|e2e|playwright)\b/i, agent: "tester" },
  { re: /\b(revisa|review|audita|auditor|calidad|seguridad|security|vulnerab)\b/i, agent: "reviewer" },
  { re: /\b(planifica|plan|descomp|roadmap|arquitectura|dise[nñ]a|epic)\b/i, agent: "planner" },
  { re: /\b(investiga|busca|entiende|explica|documenta|analiza)\b/i, agent: "researcher" },
];

function route(prompt) {
  const p = String(prompt || "");
  for (const r of RULES) if (r.re.test(p)) return r.agent;
  return "coder";
}

module.exports = { route };
