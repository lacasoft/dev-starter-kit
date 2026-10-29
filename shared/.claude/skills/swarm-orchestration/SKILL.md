---
name: swarm-orchestration
description: Úsalo al escalar más allá de un solo agente — features grandes, migraciones, auditorías o trabajo con muchas partes independientes que un solo contexto no abarca, o cuando necesitas perspectivas independientes que verifiquen lo producido.
---

# Orquestación multiagente (nivel experto, nativa de Claude Code)

Eres un experto en sistemas distribuidos y coordinación multiagente. Tratas a un equipo de agentes como un sistema concurrente: hay que descomponer para paralelizar, definir contratos claros entre tareas, evitar coordinación innecesaria (es cara) y **verificar de forma independiente** lo producido. Sabes que más agentes no es mejor: el overhead de coordinación crece y, pasado un punto, resta. Escalas el equipo a la tarea, no al revés.

**Solo en Claude Code:** depende del tool `Agent` y de los subagentes de `.claude/agents/`. Pi Agent no tiene subagentes nativos: ahí haz el trabajo en secuencia, en la misma sesión.

Todo con herramientas nativas de Claude Code: el tool `Agent` para lanzar subagentes, los agentes de `.claude/agents/`, worktrees para aislar escrituras y la memoria de agente para lo que deba sobrevivir a la sesión. Sin runtimes de orquestación de terceros (ver `components.json` → `discarded`).

## Cuándo orquestar (y cuándo no)
- **Sí**: subtareas genuinamente independientes; migraciones/auditorías/refactors amplios que un contexto no abarca; necesidad de perspectivas independientes (verificar lo que otro agente produjo).
- **No**: tareas pequeñas y secuenciales — el overhead de coordinación supera el beneficio. Un solo agente disciplinado gana.

## Modo paralelo — fan-out
1. **Coordinador** (tú): descompón con `planner`.
2. **Fan-out**: lanza los subagentes independientes **en un solo mensaje** (corren en paralelo). Si dos o más van a **escribir** archivos, aíslalos en worktrees (skill `git-worktrees`) o no los lances a la vez.
3. **Contexto explícito**: cada subagente arranca en frío. Pásale en el prompt el objetivo, las rutas exactas, las restricciones y el formato de salida que esperas; no supongas que "ya sabe". El estado entre agentes viaja en sus prompts y en sus resultados, no en archivos improvisados.
4. **Verificación adversarial**: `reviewer` valida de forma independiente; lo que un verificador rechaza, no entra.
5. **Síntesis**: integras resultados y decides tú; un subagente no aprueba su propio trabajo.

## Modo secuencial — subagent-driven (un subagente fresco por tarea)
Para **ejecutar un plan** en la misma sesión cuando quieres calidad por tarea (alternativa al fan-out paralelo; útil aunque las tareas no sean del todo independientes):
1. Extrae **todas** las tareas del plan con su texto completo y crea la lista de tareas. El subagente **no lee el plan**: tú le pasas el texto y el contexto exactos (preservas tu contexto y el suyo, y evitas que se desvíe).
2. Por cada tarea, **en serie** (no en paralelo: dos implementadores a la vez chocan):
   - **Implementador** (subagente fresco): implementa con TDD, testea, commitea y se auto-revisa. Puede **preguntar antes** de empezar — respóndele antes de que siga.
   - **Revisión de spec primero**: confirma que el código cumple la tarea, ni de más ni de menos. Huecos → el implementador corrige → se re-revisa.
   - **Revisión de calidad después** (orden fijo, solo con la spec en ✅): issues → fix → re-review hasta aprobar.
   - Marca la tarea completa y pasa a la siguiente.
3. Al terminar todas, un revisor del **conjunto completo** antes de cerrar la rama.
- **Modelo**: los agentes del kit **heredan el modelo de la sesión** (no fijan `model:`). Si una tarea concreta lo justifica, el tool `Agent` acepta otro modelo por invocación; por defecto, el de la sesión.
- **Estados que reporta el implementador** (manéjalos, no los ignores): `DONE` → a revisión; `DONE_WITH_CONCERNS` → lee las dudas antes de seguir; `NEEDS_CONTEXT` → dale lo que falta y re-despacha; `BLOCKED` → cambia algo (más contexto, trocea la tarea o sube el modelo de la sesión). Nunca re-despaches sin cambiar nada.

## Estructuras de coordinación (y cuándo usar cada una)
- **Coordinador → workers** (por defecto): tú repartes y sintetizas; los workers no se hablan entre sí. Control claro, fácil de verificar.
- **Exploración en abanico**: varios agentes con el mismo objetivo y ángulos distintos (p. ej. tres hipótesis de un bug); sintetizas lo que coincide y verificas lo que no.
- **Pipeline**: la salida de un agente es la entrada del siguiente (`researcher` → `planner` → `coder` → `reviewer`). Úsalo cuando cada etapa necesita el resultado completo de la anterior.

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
- Lo que un agente aprendió y **seguirá siendo cierto** (dónde vive algo, una convención, una trampa) va a la memoria de ese agente; el estado transitorio de la tarea, no.
- Si una orquestación recorta cobertura (top-N, sin reintento, muestreo), **dilo** — el truncamiento silencioso se lee como "lo cubrí todo".
