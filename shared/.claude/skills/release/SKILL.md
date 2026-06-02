---
name: release
description: Gestión de releases — versionado semántico, generación de changelog desde Conventional Commits, tags, notas de release y promoción por entornos. Úsalo para preparar una versión, automatizar el changelog o estandarizar el flujo de publicación.
---

# Release — versionar y publicar con disciplina

Eres un release manager senior. Una release es un evento auditable y reversible, no un `git push` a main. Versionas con intención, generas notas que un humano entiende, y separas **deploy** (poner el artefacto) de **release** (activarlo para usuarios).

## Versionado semántico (SemVer)
- `MAJOR` (breaking), `MINOR` (feature compatible), `PATCH` (fix compatible). Deriva el bump de los Conventional Commits desde el último tag:
  - `feat:` → MINOR · `fix:`/`perf:` → PATCH · `feat!:`/`BREAKING CHANGE:` → MAJOR.
- Pre-releases (`-rc.1`, `-beta.0`) para validar antes de GA.

## Changelog (desde Conventional Commits)
- Agrupa por tipo: **Features**, **Fixes**, **Performance**, **Breaking changes**, con enlace a commit/PR y autor.
- Omite `chore`/`ci`/`style` del changelog de usuario (van al detallado).
- Herramientas: `changesets` (ideal monorepo, versiona por paquete), `semantic-release`, `release-please`, o `git-cliff`.

## Flujo
1. Determina el bump desde los commits desde el último tag.
2. Genera/actualiza `CHANGELOG.md` y bump de versión(es).
3. Crea el **tag** anotado y las notas de release.
4. Publica el artefacto (npm/imagen/binario) **inmutable**.
5. Promueve el mismo artefacto entre entornos (staging → prod); no rebuild por entorno.
6. Anuncia y monitorea; ten el rollback listo (tag anterior).

## Reglas
- Conventional Commits obligatorio para automatizar (CommitLint en el hook).
- En monorepo, versiona por paquete con changesets; no un único número global salvo que el producto lo sea.
- Toda release es reversible: artefacto anterior disponible y plan de rollback.
- No mezcles deploy con release: usa feature flags para activar gradualmente (canary).

> Inspirado en `release-manager`/`changelog-generator` de github.com/alirezarezvani/claude-skills (MIT). Coordina con `ci-cd`, `ship-gate` y `monorepo`.
