---
description: Orquesta un enjambre de agentes para una tarea grande (modo híbrido claude-flow / nativo).
---

Aplica la skill `swarm-orchestration` para la siguiente tarea: **$ARGUMENTS**

1. Usa `planner` para descomponer en subtareas con dependencias.
2. Lanza en paralelo (un solo mensaje) los subagentes para las subtareas independientes.
3. Si claude-flow está instalado, coordina con él; si no, usa el modo nativo.
4. Verifica con `reviewer` antes de integrar. Registra resultados en `.claude/memory/`.
