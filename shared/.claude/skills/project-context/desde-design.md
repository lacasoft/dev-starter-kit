# Del diseño al proyecto: design.md → CLAUDE.project.md + ADRs

Referencia de la skill `project-context` cuando parte de un `design.md` del
[system-design-kit](https://github.com/lacasoft/system-design-kit). El objetivo es que nadie
reescriba requisitos ni decisiones: el diseño se **traslada**, resumido y con la fuente a la vista.

## Cómo reconocer el documento
- Front matter con `title`, `language` (`es` o `en`) y `updated`.
- Una marca `<!-- section:<id> -->` bajo cada título. Guíate por las marcas, no por los títulos
  (pueden estar en inglés o retocados). Ids: `requirements`, `out-of-scope`, `scale`,
  `api-data-model`, `architecture`, `decisions`, `failures`, `ai-review`.
- Una sección que solo tiene `_⏳ Pendiente_` / `_⏳ Pending_` está vacía: no hay nada que trasladar.
- Si la ruta está fuera del proyecto, Claude Code pedirá permiso para leerla (o arranca con
  `claude --add-dir <carpeta del diseño>`).

## Mapeo a CLAUDE.project.md

| De design.md | A CLAUDE.project.md | Cómo |
|---|---|---|
| título + `requirements` (funcionales) | **Visión del producto** | 2-4 líneas: qué es, para quién, los casos de uso principales |
| `out-of-scope` | **Visión del producto** → línea "Fuera de alcance (v1)" | Lista corta. Es lo que más evita que el agente construya de más |
| `api-data-model` (entidades, términos) | **Modelo / dominio** | Glosario de entidades y su clave de acceso |
| `api-data-model` (endpoints, eventos) | **Arquitectura** → "Contratos" | Solo los de los casos de uso principales, con idempotencia y paginación si el diseño las fija |
| `architecture` | **Arquitectura** | Componentes y flujo principal, síncrono y asíncrono; enlaza el diagrama del diseño en vez de copiarlo |
| `failures` | **Arquitectura** → "Fallas previstas" y **Testing** | Una línea por escenario (escenario → mitigación). En *Testing*, los que merecen test de regresión |
| `requirements` (no funcionales) + `scale` | **Atributos de calidad** | Los umbrales con número (latencia, disponibilidad, consistencia) y el orden de magnitud de carga |
| `requirements` (seguridad, privacidad) | **Seguridad y compliance** | Si el diseño fija el nivel ASVS, úsalo; si no, propónlo y márcalo como pendiente |
| `decisions` | **Decisiones de arquitectura** | Un ADR por decisión (abajo) y aquí solo la línea con el enlace |
| `decisions` (tecnologías elegidas) | **Stack tecnológico** | Como "decidido en el diseño"; versiones y herramientas reales salen del repo |
| `architecture` / `decisions` (terceros, nube, región) | **Integraciones externas** y **Despliegue** | Lo que el diseño fije; lo demás, del repo |
| supuestos `(supuesto)` sin confirmar | **Pendiente de confirmar** | Cada supuesto que condiciona la implementación |
| `ai-review` | — | No se traslada: los hallazgos aceptados ya deberían estar en `decisions` o `failures`. Si hay alguno aceptado que no lo esté, señálalo |

Al principio del archivo, una línea con la fuente:

```markdown
> Diseño de origen: `<ruta>/design.md` (actualizado AAAA-MM-DD). Decisiones en `docs/adr/`.
```

Sirve para la próxima importación y para que cualquiera sepa de dónde salió el contenido.

## ADRs desde las decisiones
Por cada decisión de `decisions` que condicione el código (elegir almacenamiento, un patrón de
integración, un límite entre servicios, una política), crea un ADR con la plantilla y la
numeración de la skill `adr`:

| ADR | De dónde sale |
|---|---|
| Título | La decisión, en positivo ("Usar cola SQS para la analítica de clics") |
| Contexto | El requisito o la escala que la motiva, citando la sección del diseño |
| Decisión | Lo elegido, tal como lo dice el diseño |
| Alternativas consideradas | La alternativa descartada y por qué |
| Consecuencias | El tradeoff: lo que se gana y lo que se paga; las fallas asociadas de `failures` |
| Estado | Las decisiones las tomó la persona al diseñar: **pregunta una vez** si las marcas `Aceptado`. Sin respuesta, `Propuesto` |

- Una decisión **tachada** en el diseño (`~~…~~`) no genera ADR propio: si la nueva la sustituye,
  la nueva lo dice en su contexto.
- No crees ADRs para detalles locales que el diseño menciona de pasada; esos van como línea en
  *Arquitectura*.

## Reimportar (el diseño cambió)
- Compara el `updated` del diseño con el de la línea "Diseño de origen". Si no cambió, no hay
  nada que hacer.
- Actualiza solo lo que vino del diseño; lo que el equipo escribió después en `CLAUDE.project.md`
  se respeta (regla general de la skill).
- Un ADR `Aceptado` no se edita: si la decisión cambió, crea uno nuevo que lo **reemplace**
  y marca el anterior `Reemplazado por ADR-NNNN`, como indica la skill `adr`.

## Idioma
`CLAUDE.project.md` y los ADRs siguen el idioma del proyecto (el de su `CLAUDE.project.md` si ya
existe; si no, español). Si el diseño está en otro idioma, traduce el contenido sin cambiar el
significado ni los nombres propios de componentes.
