// Tests de detección de stack. Antes, el pom.xml tenía que contener literalmente "spring-boot",
// así que un proyecto que solo declara `org.springframework` (BOM, spring-framework sin Boot) no
// se detectaba; y los `settings.gradle`/`settings.gradle.kts` no se miraban en absoluto.
// Los casos de `build.gradle`/`build.gradle.kts` sí funcionaban ya: aquí quedan como guardas de
// regresión, no como casos nuevos.
// Además, un proyecto Java sin Spring no daba ninguna pista de por qué no se detectaba nada.
// Correr: `npm test` o `node --test`.
const { test } = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const INSTALL = path.join(__dirname, "..", "install.js");

// Crea un proyecto temporal con los archivos dados y corre el instalador en dry-run.
// Las claves pueden llevar subdirectorios ("PruebaConteo/PruebaConteo.csproj").
function detectar(archivos) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "kit-detect-"));
  for (const [nombre, contenido] of Object.entries(archivos)) {
    const destino = path.join(dir, nombre);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, contenido);
  }
  const r = spawnSync("node", [INSTALL, "--yes", "--no-flow", "--no-external", "--dry-run"], {
    cwd: dir,
    input: "",
    encoding: "utf8",
  });
  fs.rmSync(dir, { recursive: true, force: true });
  const m = (r.stdout || "").match(/Stack detectado:\s*(\S+)/);
  return { stack: m ? m[1] : null, salida: r.stdout || "", status: r.status };
}

test("detecta Spring por el starter en pom.xml", () => {
  assert.equal(detectar({ "pom.xml": "<project><artifactId>spring-boot-starter-web</artifactId></project>" }).stack, "backend/spring");
});

// NUEVO: el pom.xml sin la cadena "spring-boot" no se detectaba.
test("detecta Spring por el groupId org.springframework en pom.xml", () => {
  assert.equal(detectar({ "pom.xml": "<project><groupId>org.springframework</groupId></project>" }).stack, "backend/spring");
});

// NUEVO: los settings.gradle no se miraban.
test("detecta Spring declarado en settings.gradle.kts", () => {
  assert.equal(detectar({ "settings.gradle.kts": 'id("org.springframework.boot")' }).stack, "backend/spring");
});

// Guardas de regresión: estos ya funcionaban antes del cambio.
test("detecta Spring en Gradle con Kotlin DSL", () => {
  assert.equal(detectar({ "build.gradle.kts": 'plugins { id("org.springframework.boot") version "3.3.0" }' }).stack, "backend/spring");
});

test("detecta Spring por el plugin de dependency-management", () => {
  assert.equal(detectar({ "build.gradle": 'apply plugin: "io.spring.dependency-management"' }).stack, "backend/spring");
});

test("un proyecto Java SIN Spring no se marca como Spring y explica por qué", () => {
  const r = detectar({ "pom.xml": "<project><artifactId>quarkus-resteasy</artifactId></project>" });
  assert.equal(r.stack, null, "no debe asumir Spring: el overlay no encajaría");
  assert.match(r.salida, /proyecto Java\/Kotlin/, "debe decir que vio un proyecto Java");
  assert.match(r.salida, /backend\/spring/, "debe sugerir el flag si aplica");
  assert.equal(r.status, 1, "sin stack no debe salir en verde");
});

test("detecta C# por el .csproj", () => {
  assert.equal(detectar({ "Api.csproj": "<Project Sdk=\"Microsoft.NET.Sdk.Web\" />" }).stack, "backend/dotnet");
});

test("detecta Angular por angular.json", () => {
  assert.equal(detectar({ "angular.json": "{}" }).stack, "frontend/angular");
});

test("detecta Angular por la dependencia @angular/core", () => {
  assert.equal(detectar({ "package.json": '{"dependencies":{"@angular/core":"^20.0.0"}}' }).stack, "frontend/angular");
});

// El manifiesto no siempre está en la raíz del repo. En .NET es lo normal.
test("detecta C# con el .csproj en un subdirectorio (layout normal de .NET)", () => {
  const r = detectar({ "PruebaConteo/PruebaConteo.csproj": '<Project Sdk="Microsoft.NET.Sdk" />' });
  assert.equal(r.stack, "backend/dotnet");
  assert.match(r.salida, /PruebaConteo\//, "debe decir dónde encontró la evidencia");
});

test("detecta C# en el layout src/App/App.csproj", () => {
  assert.equal(detectar({ "src/App/App.csproj": '<Project Sdk="Microsoft.NET.Sdk" />' }).stack, "backend/dotnet");
});

test("detecta Spring y Angular anidados", () => {
  assert.equal(detectar({ "backend/pom.xml": "<project>spring-boot-starter</project>" }).stack, "backend/spring");
  assert.equal(detectar({ "web/angular.json": "{}" }).stack, "frontend/angular");
});

test("la raíz gana sobre cualquier subdirectorio", () => {
  const r = detectar({
    "package.json": '{"dependencies":{"@nestjs/core":"^10"}}',
    "sub/Legacy.csproj": '<Project Sdk="Microsoft.NET.Sdk" />',
  });
  assert.equal(r.stack, "backend/nestjs", "el proyecto de la raíz manda");
  assert.doesNotMatch(r.salida, /no por la raíz/, "no debe anunciar evidencia anidada");
});

test("no confunde artefactos de build con el proyecto", () => {
  assert.equal(detectar({ "obj/Debug/generado.csproj": "<Project />" }).stack, null, "obj/ debe ignorarse");
  assert.equal(detectar({ "node_modules/x/angular.json": "{}" }).stack, null, "node_modules/ debe ignorarse");
});

test("la pista distingue otros ecosistemas sin overlay", () => {
  assert.match(detectar({ "go.mod": "module x" }).salida, /Go/);
  assert.match(detectar({ "Cargo.toml": "[package]" }).salida, /Rust/);
});
