// Pattern learning mínimo sobre la memoria del proyecto.
// record(): guarda un patrón/observación. suggest(): recupera los más relevantes por solapamiento de palabras.
const memory = require("./memory.cjs");

function record(pattern) {
  memory.append({ kind: pattern.kind || "pattern", ...pattern });
}

function suggest(context) {
  const words = new Set(
    String(context || "")
      .toLowerCase()
      .split(/\W+/)
      .filter(Boolean)
  );
  return memory
    .readAll()
    .filter((e) => e.text)
    .map((e) => {
      const ew = new Set(String(e.text).toLowerCase().split(/\W+/));
      let s = 0;
      for (const w of words) if (ew.has(w)) s++;
      return { e, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map((x) => x.e);
}

module.exports = { record, suggest };
