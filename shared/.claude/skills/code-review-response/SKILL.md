---
name: code-review-response
description: Úsalo al recibir feedback de una revisión de código (de una persona o de otro agente) antes de implementar los cambios, especialmente si una sugerencia no está clara o te parece técnicamente cuestionable.
---

# Responder a una revisión de código — rigor técnico, no cortesía

Una revisión se evalúa, no se actúa por reflejo. El feedback externo son **sugerencias que evaluar**, no órdenes que obedecer.

**Principio central: verifica antes de implementar, pregunta antes de asumir. Corrección técnica por encima de comodidad social.**

## El patrón de respuesta
1. **Lee** todo el feedback sin reaccionar.
2. **Entiende**: reformula cada punto con tus palabras (o pregunta si no lo tienes claro).
3. **Verifica** contra la realidad del código (no contra lo que el revisor *cree*).
4. **Evalúa**: ¿es correcto **para este** repo y stack?
5. **Responde**: reconocimiento técnico o **pushback razonado** si está mal.
6. **Implementa**: de a un ítem, probando cada uno.

## Prohibido (acuerdo performativo)
- "Tienes toda la razón" · "¡Buen punto!" · "¡Gracias por el aporte!" · cualquier expresión de gratitud.
- "Déjame implementarlo ya" **antes** de verificar.

**En su lugar**: reformula el requisito, pregunta lo que no entiendas, haz pushback con razonamiento técnico, o simplemente arréglalo y muéstralo en el código. Las acciones hablan; si te cachas escribiendo "Gracias", bórralo y enuncia el fix.

## Si algo no está claro → para
No implementes **nada** todavía: pide aclaración de los ítems confusos primero. Los puntos pueden estar relacionados; entender a medias = implementar mal.
> "Entiendo los puntos 1, 2, 3 y 6. Necesito aclaración del 4 y el 5 antes de seguir."

## Cuándo hacer pushback (con razonamiento, no a la defensiva)
- La sugerencia rompe funcionalidad existente.
- El revisor no tiene el contexto completo.
- Viola YAGNI: si sugiere "implementarlo bien", **grepea el codebase** — si nadie lo llama, propón quitarlo en vez de ampliarlo.
- Es incorrecta para este stack, o hay razones de compatibilidad/legacy.
- Choca con una decisión de arquitectura previa del usuario → para y discútelo con él.

Si no puedes verificar algo, **dilo**: "No puedo verificar esto sin X. ¿Investigo, pregunto o sigo?".

## Orden de implementación
Aclara lo confuso primero. Luego: bloqueantes (rompe/seguridad) → fixes simples (typos, imports) → fixes complejos (refactor, lógica). Prueba cada fix individualmente y verifica que no haya regresiones.

## Reconocer feedback correcto
✅ "Arreglado. [qué cambió]" · "Buen catch — [issue]. Corregido en [ubicación]." · (o simplemente arréglalo y que el código lo muestre).
Si hiciste pushback y te equivocaste: "Tenías razón — verifiqué X y efectivamente Y. Corrigiendo." Factual y a otra cosa, sin disculpas largas ni defender por qué empujaste.

> Destilado de la skill `receiving-code-review` de Superpowers (github.com/obra/superpowers, MIT). Complementa al agente `reviewer` (que **emite** la revisión).
