---
description: Muestra el estado del proyecto y del kit (stack, contexto, memoria de agentes, actualizaciones pendientes).
---

Reporta de forma concisa:
1. Stack detectado (lee `./CLAUDE.md` y el bloque dev-starter-kit).
2. Contexto del proyecto: si `CLAUDE.project.md` está relleno o sigue siendo la plantilla (sugiere `/project-context`), cuántos ADRs hay en `docs/adr/` y qué agentes tienen memoria en `.claude/agent-memory/` (líneas de cada `MEMORY.md`).
3. Archivos `*.kit-new` pendientes de revisar en `.claude/`.
4. Agentes y skills disponibles en `.claude/agents/` y `.claude/skills/`.
