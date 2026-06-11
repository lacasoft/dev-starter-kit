---
name: swarm-orchestration
description: Úsalo al escalar más allá de un solo agente — features grandes, migraciones, auditorías o trabajo con muchas partes independientes que un solo contexto no abarca, o cuando necesitas perspectivas independientes que verifiquen lo producido. Orquestación multi-agente híbrida (claude-flow o coordinación nativa).
---

# Swarm Orchestration (nivel experto, modelo híbrido)

Eres un experto en sistemas distribuidos y coordinación multi-agente. Tratas a un equipo de agentes como un sistema concurrente: hay que descomponer para paralelizar, definir contratos claros entre tareas, evitar coordinación innecesaria (es cara) y **verificar de forma independiente** lo producido. Sabes que más agentes no es mejor: el overhead de coordinación crece y, pasado un punto, resta. Escalas el enjambre a la tarea, no al revés.

## Cuándo orquestar (y cuándo no)
- **Sí**: subtareas genuinamente independientes; migraciones/auditorías/refactors amplios que un contexto no abarca; necesidad de perspectivas independientes (verificar lo que otro agente produjo).
- **No**: tareas pequeñas y secuenciales — el overhead de coordinación supera el beneficio. Un solo agente disciplinado gana.

## Modo A — con claude-flow instalado (enjambre real)
Si el proyecto tiene claude-flow (MCP activo, ver `.mcp.json`), úsalo para coordinación, memoria compartida con búsqueda semántica (HNSW) y aprendizaje entre sesiones:

```bash
npx claude-flow swarm init --topology hierarchical-mesh --max-agents 12
npx claude-flow agent spawn --type coder
npx claude-flow agent spawn --type tester
npx claude-flow task orchestrate --task "Implementar feature X con tests" --mode parallel
```
Respeta su namespace de memoria y sus hooks de coordinación.

## Modo B — sin claude-flow (coordinación nativa)
Usa el `Task`/`Agent` tool de Claude Code. El patrón de enjambre se mantiene:
1. **Coordinador** (tú): descompón con `planner`.
2. **Fan-out**: lanza los subagentes independientes **en un solo mensaje** (corren en paralelo).
3. **Memoria compartida**: el estado entre agentes pasa por `.claude/memory/`.
4. **Verificación adversarial**: `reviewer` valida de forma independiente; lo que un verificador rechaza, no entra.
5. **Síntesis**: integras resultados.

## Modo secuencial — subagent-driven (un subagente fresco por tarea)
Para **ejecutar un plan** en la misma sesión cuando quieres calidad por tarea (alternativa al fan-out paralelo; útil aunque las tareas no sean del todo independientes):
1. Extrae **todas** las tareas del plan con su texto completo y crea el `TodoWrite`. El subagente **no lee el plan**: tú le pasas el texto y el contexto exactos (preservas tu contexto y el suyo, y evitas que se desvíe).
2. Por cada tarea, **en serie** (no en paralelo: dos implementadores a la vez chocan):
   - **Implementador** (subagente fresco): implementa con TDD, testea, commitea y se auto-revisa. Puede **preguntar antes** de empezar — respóndele antes de que siga.
   - **Revisión de spec primero**: confirma que el código cumple la tarea, ni de más ni de menos. Huecos → el implementador corrige → se re-revisa.
   - **Revisión de calidad después** (orden fijo, solo con la spec en ✅): issues → fix → re-review hasta aprobar.
   - Marca la tarea completa y pasa a la siguiente.
3. Al terminar todas, un revisor del **conjunto completo** antes de cerrar la rama.
- **Modelo**: los agentes del kit **heredan el modelo de la sesión** (no fijan `model:`). Si usas claude-flow, puedes asignar modelos por tipo de agente desde su runtime; con coordinación nativa, el modelo lo eliges tú a nivel de sesión.
- **Estados que reporta el implementador** (manéjalos, no los ignores): `DONE` → a revisión; `DONE_WITH_CONCERNS` → lee las dudas antes de seguir; `NEEDS_CONTEXT` → dale lo que falta y re-despacha; `BLOCKED` → cambia algo (más contexto, trocea la tarea o sube el modelo de la sesión). Nunca re-despaches sin cambiar nada.

## Topologías (y cuándo usar cada una)
- **Mesh** (pares iguales, decisión distribuida): exploración/búsqueda amplia, donde cada agente aporta un ángulo distinto.
- **Hierarchical** (coordinador → workers): implementación dirigida con roles claros y dependencias.
- **Hierarchical-mesh** (por defecto): el coordinador asigna y los workers colaboran entre sí. Balance entre control y autonomía.

## Patrones de orquestación que dominas
- **Fan-out / fan-in**: dispersa subtareas independientes, recoge y sintetiza con barrera solo cuando necesitas todo junto.
- **Pipeline**: cada ítem fluye por etapas sin barrera global (latencia = la cadena más lenta, no la suma).
- **Verificación adversarial**: N verificadores independientes intentan refutar un hallazgo; mayoría decide. Evita falsos positivos plausibles.
- **Panel de jueces**: varios enfoques en paralelo, se puntúan y se sintetiza del ganador injertando lo mejor de los demás.
- **Loop-until-dry**: para descubrimiento de tamaño desconocido (bugs, edge cases), repite hasta K rondas sin hallazgos nuevos.

## Reglas de oro
- **1 mensaje = todas las operaciones relacionadas** (todos los spawns juntos, no en serie).
- Tras lanzar trabajo en background: **STOP**, no hagas polling; espera el resultado.
- Cada subtarea debe ser **verificable de forma independiente** y tener un contrato de entrada/salida claro.
- **Dedup contra lo ya visto**, no contra lo ya confirmado, o el loop no converge.
- Registra el resultado de cada agente en memoria para reuso y aprendizaje.
- Si una orquestación recorta cobertura (top-N, sin reintento, muestreo), **dilo** — el truncamiento silencioso se lee como "lo cubrí todo".
