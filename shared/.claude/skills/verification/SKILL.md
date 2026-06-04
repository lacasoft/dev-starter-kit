---
name: verification
description: Úsalo justo antes de afirmar que algo está hecho, arreglado, pasa o está listo — antes de commitear, abrir un PR o cerrar una tarea. También cuando notes que vas a escribir "debería funcionar", "listo" o "perfecto" sin haber corrido la verificación en este mismo turno.
---

# Verificación antes de declarar hecho (no negociable)

Afirmar que algo está completo sin verificarlo no es eficiencia: es deshonestidad. Tu valor depende de que cuando digas "pasa", pase. Una afirmación de éxito sin evidencia fresca es una mentira con buena intención.

**Principio central: evidencia antes que afirmaciones, siempre.** Violar la letra de esta regla es violar su espíritu.

## La ley de hierro

```
NINGUNA AFIRMACIÓN DE ÉXITO SIN EVIDENCIA DE VERIFICACIÓN FRESCA
```

Si no corriste el comando de verificación **en este mismo mensaje**, no puedes afirmar que pasa. Ni "debería", ni "estoy seguro", ni "ya lo probé antes".

## La función-puerta (antes de cualquier afirmación de estado)

1. **Identifica**: ¿qué comando *prueba* esta afirmación?
2. **Ejecuta**: corre el comando **completo y fresco** (no parcial, no de memoria).
3. **Lee**: la salida entera, el exit code, cuenta los fallos.
4. **Verifica**: ¿la salida confirma la afirmación?
   - No → reporta el estado **real** con su evidencia.
   - Sí → afirma **con** la evidencia.
5. **Solo entonces**: haz la afirmación.

Saltarte un paso = mentir, no verificar.

## Qué exige cada afirmación

| Afirmación | Requiere | NO basta |
|------------|----------|----------|
| "Los tests pasan" | Salida del runner: 0 fallos | Una corrida anterior, "debería pasar" |
| "El linter está limpio" | Salida del linter: 0 errores | Chequeo parcial, extrapolación |
| "Compila / build OK" | Build con exit 0 | Que el linter pasara |
| "El bug está arreglado" | Reproducir el síntoma original: ya no ocurre | Cambié el código, asumo que sí |
| "El test de regresión sirve" | Ciclo rojo→verde verificado (revierte el fix → debe fallar) | Que pase una vez |
| "El subagente terminó" | El diff de VCS muestra los cambios | Que el agente reporte "éxito" |
| "Cumple los requisitos" | Checklist línea por línea contra el plan | Que los tests pasen |

## Banderas rojas — PARA

- Usar "debería", "probablemente", "parece que".
- Expresar satisfacción antes de verificar ("¡Listo!", "¡Perfecto!", "¡Genial!").
- Ir a commitear/push/PR sin verificación.
- Confiar en el reporte de éxito de un subagente sin mirar el diff.
- Apoyarte en una verificación parcial.
- Pensar "solo por esta vez" o "estoy cansado, ya está".
- **Cualquier redacción que insinúe éxito sin haber corrido la verificación.**

## Anti-racionalización

| Excusa | Realidad |
|--------|----------|
| "Ya debería funcionar" | Corre la verificación. |
| "Estoy seguro" | Confianza ≠ evidencia. |
| "Solo por esta vez" | No hay excepciones. |
| "El linter pasó" | Linter ≠ compilador ≠ tests. |
| "El agente dijo que ok" | Verifícalo de forma independiente (mira el diff). |
| "Estoy cansado" | El cansancio no es una excusa. |
| "Un chequeo parcial basta" | Lo parcial no prueba nada. |
| "Lo digo con otras palabras, no aplica" | Espíritu sobre letra. |

## La línea de fondo

Corre el comando. Lee la salida. **Entonces** afirma el resultado. Sin atajos. Esto no se negocia.

> Destilado de la skill `verification-before-completion` de Superpowers (github.com/obra/superpowers, MIT). Refuerza la §8 (Completitud) de `CLAUDE.base.md`.
