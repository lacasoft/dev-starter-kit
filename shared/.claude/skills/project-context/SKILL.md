---
name: project-context
description: Úsalo cuando CLAUDE.project.md falte, siga siendo la plantilla o se haya quedado viejo (cambió el stack, los comandos, la estructura o el despliegue), al llegar a un repo heredado, cuando el agente se equivoque una y otra vez por desconocer cómo funciona este proyecto, o cuando exista un design.md de System Design (system-design-kit) del que partir para no reescribir requisitos ni decisiones.
argument-hint: "[área o paquete a profundizar | ruta a design.md]"
---

# Contexto del proyecto — CLAUDE.project.md a partir del repo real

Eres quien hace el onboarding de un agente en un repo que no conoce. Sabes que el mayor salto de calidad no viene de más reglas genéricas, sino de que el agente sepa **cómo funciona este proyecto en concreto**: con qué se construye, cómo se prueba, dónde vive cada cosa y qué no se puede romper. Tu entrega es `CLAUDE.project.md`, que el `CLAUDE.md` raíz importa en cada sesión.

Las rutas que nombra esta skill (`CLAUDE.project.md`, `docs/adr/`, `.claude/…`) son relativas a la raíz del proyecto, donde está `CLAUDE.md`; no a la carpeta de la skill, salvo `desde-design.md`, que está junto a este archivo.

## Principios
- **Verificado o marcado**: lo que escribes sale de un archivo que leíste o de un comando que corriste. Lo que no puedes confirmar va como pregunta, no como afirmación.
- **Solo lo que no se deduce rápido**: nada de listar cada carpeta ni repetir lo que dice el código. Lo que un ingeniero nuevo tardaría una mañana en averiguar.
- **Corto**: apunta a menos de 150 líneas. Todo se carga en cada sesión y la adherencia baja con el tamaño. Si un área necesita más detalle, propón una regla con `paths:` en `.claude/rules/` (se carga solo al tocar esos archivos), fuera de `.claude/rules/kit/`, que gestiona el instalador.
- **Cero secretos**: nombres de variables de entorno sí; valores nunca.

## 0. Si partes de un diseño (design.md)
Si el argumento es una ruta a un `design.md` del **system-design-kit** (front matter con `language` y marcas `<!-- section:<id> -->`), ese documento es la fuente de **lo que el repo no puede decir**: visión, requisitos, escala, decisiones y fallas. La persona ya lo pensó y lo decidió; tu trabajo es trasladarlo sin reescribirlo ni reinterpretarlo. Lee [desde-design.md](desde-design.md) y sigue su mapeo. Lo derivable del repo (stack real, comandos, estructura) sigue saliendo de los pasos 1-3: el diseño no sustituye al código.

## 1. Lee lo que hay
`CLAUDE.project.md` actual (si existe, **actualízalo**, no lo reescribas: conserva lo que escribió el equipo), `README`, manifiestos y lockfiles, configuración de lint/format/tests, `Makefile`/scripts, Dockerfile y compose, workflows de CI, `.env.example`, `docs/adr/`, y la estructura de primer y segundo nivel. Si el argumento nombra un área, profundiza ahí.

## 2. Confirma los comandos
Los comandos de build, test y lint del proyecto se **corren** antes de escribirlos (si son seguros y rápidos: nada que despliegue, migre una base real o tarde más de unos minutos). Un comando que no funciona tal como está documentado es el gotcha más valioso que puedes dejar escrito.

## 3. Rellena lo derivable
Siguiendo las secciones de la plantilla: stack con versiones y el linter/formatter **real**, estructura (en monorepo, cada paquete con su stack y su responsabilidad), arquitectura observada (capas, módulos, flujos principales con su ruta), comandos confirmados, despliegue y CI, variables de entorno críticas (de `.env.example` y de la capa de config), testing (framework, dónde viven, cobertura que se mide).

## 4. Pregunta lo que no se puede derivar
Si partiste de un `design.md`, pregunta solo lo que el diseño no responde. Si no, en **una sola tanda** y priorizado, a la persona: visión y usuarios del producto, invariantes de negocio que no se pueden violar, requisitos de seguridad y compliance, **nivel ASVS** objetivo (propón uno: L1, o L2 si hay auth, datos personales o pagos), atributos de calidad con umbral (latencia, disponibilidad), integraciones y sus reglas. Lo que no te respondan queda marcado como pendiente en el archivo, no inventado.

## 5. Escribe y cierra
- Elimina el comentario de plantilla y las secciones que no aplican; deja las preguntas abiertas en una sección final **Pendiente de confirmar**.
- Si encontraste decisiones de arquitectura importantes sin registrar, propón ADRs (skill `adr`) en vez de narrarlas en este archivo.
- Lo que aprendiste del repo que no cabe aquí pero conviene recordar (dónde vive algo, trampas) va a la memoria del agente `researcher`.
- Resume a la persona qué se confirmó, qué se infirió y qué quedó pendiente.

## Reglas
- No toques el bloque gestionado de `CLAUDE.md` (entre los comentarios `dev-starter-kit overlay`): lo regenera el instalador.
- No copies reglas de la baseline ni del overlay del stack: ya se cargan; aquí solo va lo propio del proyecto.
- Si el repo contradice algo que el equipo escribió en `CLAUDE.project.md`, no lo pises: señálalo y pregunta.
