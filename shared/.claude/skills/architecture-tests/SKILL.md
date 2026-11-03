---
name: architecture-tests
description: Úsalo para convertir los límites de CLAUDE.project.md (Responsabilidades y límites, Contextos y propiedad) en reglas que fallen solas en el lint o los tests (quién importa a quién, quién escribe qué datos, qué expone cada módulo, sin ciclos), o cuando alguien dé por aislado un módulo solo porque tiene su carpeta o es un módulo del framework.
---

# Tests de arquitectura: de la intención a la restricción

Las rutas que nombra esta skill (`CLAUDE.project.md`, `.claude/…`) son relativas a la raíz del proyecto, donde está `CLAUDE.md`; no a la carpeta de la skill.

Un límite escrito en `CLAUDE.project.md` es una **intención**: se cumple mientras todos lo recuerdan. Se vuelve **restricción** cuando una regla lo comprueba en cada corrida del lint o de los tests y falla si alguien lo cruza. Las carpetas, los routers y los módulos del framework (módulos de NestJS o de Angular, apps de Django) no impiden ningún import: no des un módulo por aislado solo por eso.

## Qué se puede comprobar

| Límite | Regla | Ejemplo |
|---|---|---|
| Dependencias | A no importa de B, o las capas solo dependen hacia adentro | `solicitudes` no importa nada de `nomina` |
| Interfaz pública | Desde fuera, un módulo solo se usa por su entrada pública. Sus repositorios y modelos del ORM no salen de él | Otros módulos importan `saldos/index.ts`, nunca `saldos/saldo.repository.ts` |
| Propiedad de los datos | Solo el dueño importa el modelo o el repositorio de sus tablas | Solo `saldos` importa `SaldoEntity` |
| Ciclos | Ningún ciclo entre módulos | `solicitudes → aprobaciones → solicitudes` falla |
| Contratos, invariantes y recuperación | No son reglas de dependencias: son tests, y los escribe la skill `tdd` | Aprobar una solicitud no modifica el saldo |

La regla de imports protege la propiedad de los datos en el código. Si el riesgo lo pide (dinero, datos personales, varios servicios sobre la misma base), la protección fuerte está en la base: un esquema y un usuario por módulo, con permisos solo sobre lo suyo. Propónla; no la impongas.

## Herramientas por stack

Todas son libres y no piden cuenta ni clave. Revisa en su documentación lo que trae la versión que instales.

| Stack | Herramienta (licencia) | Qué usar |
|---|---|---|
| NestJS, Express, React, Next.js, Angular, React Native | dependency-cruiser (MIT) | Reglas `forbidden` con `from` y `to`; interfaz pública con `pathNot`; ciclos con `circular: true`. En un monorepo Nx, `@nx/enforce-module-boundaries` (MIT) |
| FastAPI, Django | import-linter (BSD-2-Clause) | Contratos `forbidden`, `protected` (solo una lista de módulos puede importar), `layers`, `independence` y `acyclic_siblings` |
| Spring | Spring Modulith (Apache-2.0) para un monolito modular, o ArchUnit (Apache-2.0) para reglas a la medida | `ApplicationModules.of(App.class).verify()` comprueba la interfaz pública y los ciclos entre módulos. En ArchUnit, `noClasses()…` y `slices().matching(…).should().beFreeOfCycles()` |
| .NET | ArchUnitNET (Apache-2.0) | Reglas de dependencia, y `Slices().Matching(…).Should().BeFreeOfCycles()` |
| PHP | deptrac (MIT) | Capas y las dependencias permitidas entre ellas: todo lo que no se permite, falla |
| Flutter | lakos (MIT) | `--no-cycles-allowed` para los ciclos. Para las demás reglas, el test sin dependencias (abajo) |
| Solidity | No aplica | Los límites entre contratos se protegen con control de acceso y tests de invariantes (Foundry) |

**Sin dependencias nuevas.** Si la persona no quiere agregar una herramienta, o el stack no tiene una, escribe un test con el framework de tests del proyecto que lea los archivos fuente y falle ante un import prohibido. Es más débil: no resuelve alias, reexportaciones ni imports dinámicos. Dilo en la línea de esa restricción.

## Proceso
1. **Lee los límites** en `CLAUDE.project.md`: *Arquitectura → Responsabilidades y límites*, *Modelo / dominio → Contextos y propiedad* y las reglas de límite de *Reglas de negocio*. Si no hay ninguno, no los inventes: propón correr `project-context`, o pregunta cuáles son los módulos y quién es dueño de qué.
2. **Ubica cada módulo en el código.** Si un límite no corresponde a ninguna carpeta o paquete, dilo antes de seguir: primero hay que decidir dónde vive.
3. **Traduce cada límite a una regla**, una por límite, con un mensaje que lo nombre (por ejemplo, "Solo Saldos escribe el saldo; ver CLAUDE.project.md"). Lo que no se pueda expresar como regla queda como intención, con el motivo.
4. **Elige la herramienta** del stack. Agregarla es instalar una dependencia de desarrollo: pide confirmación y sigue la baseline §6.1 (versión exacta, publicada hace 7 días o más y licencia revisada en su archivo LICENSE).
5. **Prueba que cada regla falla.** Introduce a propósito una violación (un import prohibido en un archivo temporal), corre la regla, confirma que falla con su mensaje y deshaz el cambio. Una regla que nunca falló no protege nada, igual que un test que nunca estuvo en rojo.
6. **Hazla correr sola.** Que forme parte del comando de lint o de tests que ya corren la CI, la skill `ship-gate` y el verificador de `loop-task`, no de un comando aparte que nadie recuerda.
7. **Si el código ya viola un límite**, no lo arregles en el mismo cambio. Deja la excepción explícita en la regla, con el archivo y el motivo, y anota la deuda en *Notas / gotchas*. La excepción no se amplía.
8. **Anota el resultado** en `CLAUDE.project.md` → *Testing* → "Restricciones de arquitectura": una línea por límite, con dónde se comprueba o "intención" y el motivo.

```markdown
### Restricciones de arquitectura
- Solo Saldos escribe el saldo → automatizada: `.dependency-cruiser.cjs` (regla `solo-saldos-escribe-saldo`), en `npm run lint`
- Sin ciclos entre módulos → automatizada: `.dependency-cruiser.cjs` (regla `no-circular`), en `npm run lint`
- Aprobaciones no decide el saldo → intención: es comportamiento, no dependencia; lo cubre el test `aprobar-no-modifica-saldo`
```

## Reglas
- No digas que un módulo está "aislado", "desacoplado" o es "independiente" sin una regla que lo compruebe. Si no la hay, di "por convención".
- Las reglas reflejan los límites decididos; no inventes límites nuevos. Si ves uno que falta, propónlo.
- Una excepción sin motivo escrito es un límite borrado.
- En un monorepo, la dirección entre paquetes la dan sus dependencias declaradas (skill `monorepo`); estas reglas cuidan los límites dentro de cada paquete.
