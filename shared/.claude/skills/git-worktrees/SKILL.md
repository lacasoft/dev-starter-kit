---
name: git-worktrees
description: Úsalo al empezar trabajo (una feature, un plan de implementación, un experimento) que conviene aislar de tu workspace actual para no contaminar la rama en curso. También cuando vayas a lanzar varios agentes que tocan archivos en paralelo.
---

# Git worktrees — workspace aislado sin pelear con el harness

Aísla el trabajo en un workspace propio para no tocar la rama actual. **Orden de preferencia: detecta aislamiento existente → usa la herramienta nativa → recurre a `git worktree` solo si no hay nativa.** Nunca pelees con el harness creando estado que no puede ver.

## Paso 0 — ¿ya estás aislado?
Antes de crear nada, compruébalo:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

- Si `GIT_DIR != GIT_COMMON` **y no es un submódulo** → ya estás en un worktree enlazado: **no crees otro**, salta al setup (Paso 3).
- **Guarda de submódulo**: `GIT_DIR != GIT_COMMON` también es cierto dentro de un submódulo. Verifica con `git rev-parse --show-superproject-working-tree`: si devuelve una ruta, es un submódulo → trátalo como repo normal.
- Si `GIT_DIR == GIT_COMMON` → repo normal. Si el usuario no declaró ya su preferencia, **pide consentimiento** antes de crear un worktree ("¿Monto un worktree aislado para proteger tu rama actual?"). Si lo rechaza, trabaja en sitio.

## Paso 1 — crea el workspace aislado
1. **Herramienta nativa (preferida)**: si tu harness ofrece algo como `EnterWorktree`, `WorktreeCreate`, un comando `/worktree` o un flag `--worktree`, **úsalo** y salta al Paso 3. Las nativas gestionan ubicación, rama y limpieza; usar `git worktree add` cuando hay nativa crea estado fantasma que el harness no ve.
2. **Fallback `git worktree`** (solo si no hay nativa):
   - **Ubicación** (prioridad): preferencia declarada por el usuario > `.worktrees/` existente > `worktrees/` existente > por defecto `.worktrees/` en la raíz.
   - **Verifica que esté gitignoreado antes de crearlo** (crítico, para no commitear su contenido): `git check-ignore -q .worktrees`. Si no lo está, añádelo a `.gitignore` y commitea el cambio.
   - Crea: `git worktree add "$path" -b "$BRANCH_NAME" && cd "$path"`.
   - **Fallback de sandbox**: si `git worktree add` falla por permisos (sandbox), avisa al usuario y trabaja en el directorio actual.

## Paso 3 — setup y baseline
- Auto-detecta e instala deps: `package.json`→`npm install`, `Cargo.toml`→`cargo build`, `requirements.txt`/`pyproject.toml`→`pip install`/`poetry install`, `go.mod`→`go mod download`.
- **Corre los tests para confirmar baseline limpio** antes de tocar nada. Si fallan, repórtalo y pregunta si seguir o investigar (no puedes distinguir bugs nuevos de pre-existentes con un baseline roto).

## Errores típicos
- Crear un worktree cuando el Paso 0 ya detectó aislamiento (worktree anidado).
- Usar `git worktree add` teniendo una herramienta nativa — el error nº1.
- Saltarse la verificación de `.gitignore` → el worktree contamina `git status`.
- Seguir con tests en rojo sin permiso.

> Destilado de la skill `using-git-worktrees` de Superpowers (github.com/obra/superpowers, MIT).
