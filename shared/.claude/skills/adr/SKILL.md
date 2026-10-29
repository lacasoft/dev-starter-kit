---
name: adr
description: Úsalo cuando se tome o se cambie una decisión de arquitectura o de producto difícil de revertir (elegir una base de datos, un patrón de integración, un proveedor, un límite entre servicios, una política de seguridad), cuando alguien pregunte "¿por qué está hecho así?" y la respuesta no esté escrita, o cuando el equipo vuelva a discutir algo que ya se decidió.
argument-hint: "[título de la decisión]"
---

# ADR — registro de decisiones de arquitectura

Eres quien cuida la memoria de decisiones del proyecto. Un ADR captura **por qué** se eligió algo cuando se eligió, con las alternativas y sus consecuencias, para que nadie tenga que reconstruirlo leyendo código ni volver a discutirlo sin datos nuevos. Viven en `docs/adr/` y **se versionan** (la baseline los exceptúa del `/docs` ignorado): son historia del proyecto.

Las rutas que nombra esta skill (`CLAUDE.project.md`, `docs/adr/`, `.claude/…`) son relativas a la raíz del proyecto, donde está `CLAUDE.md`; no a la carpeta de la skill.

## Cuándo sí y cuándo no
- **Sí**: decisiones caras de revertir, que afectan a varios módulos o equipos, que eligen entre alternativas razonables, o que imponen una restricción (seguridad, compliance, costo).
- **No**: detalles de implementación locales, preferencias de estilo (eso va a lint o a `CLAUDE.project.md`), o lo que ya decide el framework.

Si las decisiones vienen de un `design.md` del system-design-kit, la skill `project-context` las convierte en ADRs con esta misma plantilla (ver su `desde-design.md`).

## Procedimiento
1. **Busca antes de escribir**: lista `docs/adr/`. Si ya hay un ADR sobre el tema, el nuevo lo **reemplaza** (y el viejo se marca `Reemplazado por ADR-NNNN`); no edites el contenido de uno aceptado.
2. **Numera**: siguiente número libre con 4 dígitos y título en kebab-case: `docs/adr/0007-usar-outbox-para-eventos.md`.
3. **Redacta** con la plantilla de abajo. Contexto y consecuencias honestas: incluye lo que empeora.
4. **Estado**: `Propuesto` mientras se discute; `Aceptado` solo cuando la persona responsable lo confirme. No marques `Aceptado` por tu cuenta.
5. **Enlaza**: si cambia cómo se trabaja en el repo, añade una línea en `CLAUDE.project.md` que apunte al ADR (la regla corta ahí, el porqué en el ADR).

## Plantilla

```markdown
# ADR-NNNN: <decisión en una frase, en positivo>

- Estado: Propuesto | Aceptado | Rechazado | Obsoleto | Reemplazado por ADR-NNNN
- Fecha: AAAA-MM-DD
- Decisores: <personas o rol>

## Contexto
Qué problema hay, qué fuerzas compiten (requisitos, restricciones, plazos) y qué se sabe hoy.
Atributos de calidad en juego, con el vocabulario de ISO/IEC 25010 si aplica.

## Decisión
Qué se hace, en voz activa y concreta.

## Alternativas consideradas
- <opción>: por qué no (con datos si los hay).

## Consecuencias
- Positivas: …
- Negativas y riesgos aceptados: …
- Qué tendría que pasar para revisar esta decisión.
```

## Reglas
- Un ADR = una decisión. Si mezclas dos, sepáralos.
- Escribe para alguien que llega en un año sin contexto: sin "como hablamos" ni enlaces a chats efímeros.
- Nada de secretos ni datos personales.
- Formato inspirado en Michael Nygard y MADR, redactado con palabras propias.
