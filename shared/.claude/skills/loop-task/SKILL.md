---
name: loop-task
description: Úsalo para delegar una tarea larga con un final verificable (implementar un plan hasta que pasen sus tests, migrar un módulo hasta que compile, vaciar una lista de fallos de lint o de tests) a un ciclo que trabaja solo, turno tras turno, y que solo termina cuando un verificador determinista pasa, con tope de turnos y revisión independiente al final.
argument-hint: "<objetivo> — verificador: <comando> [— tope: N turnos]"
---

# /loop-task — ciclo de trabajo con verificador (loop engineering)

En vez de pedirle a Claude cada paso, diseñas el **ciclo** que trabaja por ti: un objetivo, un verificador que el agente **no puede falsear**, un tope y una revisión independiente al final. Claude no decide cuándo terminó: lo decide el verificador. El ciclo aporta velocidad, pero no sustituye a la persona: ella revisa el resultado antes de hacer merge.

**En Pi Agent** la puerta es la extensión del kit y corre al cerrar cada turno, igual que el hook `Stop` de Claude. Lo único distinto es el cierre: Pi no tiene subagentes, así que en el paso 5 no hay `reviewer` y quien aprueba es la persona.

Las rutas que nombra esta skill (`CLAUDE.project.md`, `docs/adr/`, `.claude/…`) son relativas a la raíz del proyecto, donde está `CLAUDE.md`; no a la carpeta de la skill.

## Cuándo sí y cuándo no
- **Sí**: el final se puede comprobar con un comando (tests, typecheck, lint, build) y el camino tiene muchos pasos parecidos: implementar un plan ya decidido, migrar llamadas a un API nuevo, arreglar una tanda de tests rotos, subir la cobertura de un módulo.
- **No**: exploración o diseño ("¿cómo debería…?"), decisiones de producto o de arquitectura, tareas sin verificador posible, nada que toque producción, datos compartidos o despliegues. Tampoco tareas de un solo paso: un ciclo no compensa su costo.

## 1. El contrato
Antes de arrancar, fija con la persona (si no te lo dio en el argumento):
- **Objetivo** en una frase, con el alcance ("solo `src/billing/`").
- **Verificador**: el comando que demuestra que terminaste. Solo test, lint, typecheck o build del proyecto, encadenados con `&&` (por ejemplo `npm run typecheck && npm test`). El helper rechaza cualquier otra cosa.
- **Tope de turnos**: 10 por defecto, como máximo 50. Cada turno consume uso de tu cuenta: empieza bajo y súbelo si hace falta.
- **Qué no se toca**: archivos o comportamientos que deben quedar como están.

Si no hay verificador, **créalo primero**: el test que falla (skill `tdd`). Un ciclo sin verificador es un ciclo que puede declarar éxito sin haberlo logrado.

## 2. Aislamiento
Trabaja en una **rama o worktree propio** (skill `git-worktrees`), nunca en `main`/`master`/`develop`: el helper se niega a arrancar ahí. Lo que haga el ciclo se revisa como un PR, no se mezcla con trabajo en curso.

## 3. Arrancar

```bash
node .claude/helpers/loop.cjs start --objective "<objetivo>" --check "<verificador>" --max-turns 10
```

El helper corre el verificador una vez como **línea base**. Si ya pasa, se niega a arrancar: no mide lo que quieres lograr (para un refactor que debe mantenerse en verde, `--allow-passing`). Crea `.loop/PROGRESS.md`, la columna vertebral del ciclo, que tú escribes. El contrato (verificador, tope, turnos) queda en `.claude/loop/state.json`, que solo escribe el helper.

## 4. Cada turno
- Haz un avance concreto y verificable; no intentes todo de golpe.
- Anota en `PROGRESS.md` (sección *Notas de Claude*) qué intentaste, qué descartaste y por qué. El helper añade solo el resultado del verificador de cada turno.
- Termina el turno. El **hook Stop** corre el verificador:
  - **falla** → te devuelve el error y sigues. Arregla la causa, no el test; si el test está mal, dilo y justifícalo.
  - **pasa** → pide el cierre (paso 5).
  - **tope alcanzado** → el ciclo se detiene y la persona decide.
- El verificador, el contador de turnos y los scripts de `package.json` que usa el verificador **no se tocan**: los hooks bloquean editar el estado del ciclo, y si cambias el script del verificador la puerta lo rechaza.

## 5. Cerrar
Con el verificador en verde, quien hizo el trabajo no es quien lo aprueba:
1. Lanza el agente **`reviewer`** sobre el diff completo del ciclo y corrige lo CRITICAL o HIGH.
2. Añade a `PROGRESS.md` la sección **`## Resumen para la persona`**: qué cambió, por qué, qué decisiones tomaste y qué debería revisar ella con atención. Sin esa sección la puerta no cierra el ciclo.
3. El verificador corre una última vez y el ciclo queda cerrado.

Después, la persona revisa el diff y el resumen antes de hacer merge. Si no entiende un cambio, el ciclo no terminó: es deuda de comprensión.

**En Pi Agent**, el cierre es así:
1. Repasa tú el diff.
2. Escribe `## Resumen para la persona`.
3. Con el verificador en verde, Pi le pregunta a la persona si aprueba el cierre:
   - **Aprueba:** el ciclo se cierra.
   - **Rechaza:** dice qué falta y sigues trabajando.

Sin interfaz (`pi -p`), el ciclo queda esperando hasta que la persona corra en su terminal `node .claude/helpers/loop.cjs approve` (o `reject --reason "…"`). Tú no puedes correr esos comandos: el hook te lo niega.

## Variantes nativas de Claude Code
- **`/goal <condición>`**: un modelo aparte evalúa la condición tras cada turno. Úsalo cuando el final necesite juicio y no un comando (por ejemplo, "se cumplen los criterios de aceptación de docs/plan.md"). Escríbelo con un estado medible, cómo se demuestra y un límite: `… o detente tras 20 turnos`. Puede convivir con este ciclo: `/goal` decide si hay que seguir y el verificador decide si está bien.
- **`/loop <intervalo>`**: repite cada cierto tiempo; sirve para esperar algo externo (una CI, un despliegue), no para iterar sobre código.
- Para que los turnos corran sin pedir permiso en cada herramienta, el modo **auto** o **acceptEdits**; los hooks de seguridad del kit siguen activos igual.

## Comandos del helper

| Comando | Para qué |
|---|---|
| `loop.cjs start --check "…" [--max-turns N] [--objective "…"]` | Arranca el ciclo (verifica la línea base) |
| `loop.cjs status` | Estado, turno actual y verificador |
| `loop.cjs stop` | Detiene el ciclo a mano |
| `loop.cjs approve` / `reject --reason "…"` | Solo la persona, en Pi: aprueba el cierre o devuelve el ciclo al trabajo |

## Reglas
- Nunca amplíes el alcance para "aprovechar" el ciclo.
- Si el verificador falla por algo ajeno a la tarea (entorno, red, dependencia), detén el ciclo y dilo: no lo "arregles" desactivando tests.
- El ciclo no hace commit, push ni merge: eso lo decide la persona.
