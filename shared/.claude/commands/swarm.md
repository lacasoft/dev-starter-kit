---
description: Orquesta varios agentes para una tarea grande (coordinación nativa de Claude Code).
---

Aplica la skill `swarm-orchestration` para la siguiente tarea: **$ARGUMENTS**

1. Usa `planner` para descomponer en subtareas con dependencias.
2. Lanza en paralelo (un solo mensaje) los subagentes para las subtareas independientes; si varios escriben archivos, aíslalos en worktrees.
3. Pasa a cada subagente el contexto exacto que necesita: arranca en frío.
4. Verifica con `reviewer` antes de integrar.
