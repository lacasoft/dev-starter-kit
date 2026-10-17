# Referencia de estándares (skill `owasp-review`)

Ediciones vigentes a octubre de 2026. Si un estándar publica una edición nueva, actualiza esta tabla y su fuente al final; la clasificación de los hallazgos depende de ella.

## OWASP Top 10:2025 — qué buscar

| Categoría | Qué buscar en el código | CWE frecuentes |
|---|---|---|
| **A01** Broken Access Control | Acceso por id sin comprobar dueño o tenant; endpoints admin sin rol explícito; rutas construidas con input (traversal); peticiones salientes a URLs del usuario sin allowlist (**SSRF**, que en 2025 vive aquí); CORS permisivo con credenciales; open redirect | 22, 200, 284, 352, 601, 639, 862, 863, 918 |
| **A02** Security Misconfiguration | Debug o stack traces en prod; cookies sin `Secure`/`HttpOnly`/`SameSite`; XML con entidades externas habilitadas; CORS `*`; headers de seguridad ausentes; defaults de framework sin endurecer | 16, 611, 614, 942, 1004 |
| **A03** Software Supply Chain Failures | Dependencias nuevas sin versión fija o con versión de hace días; scripts `postinstall`; lockfile ausente o desincronizado; actions de CI sin pinear por SHA; paquetes abandonados o con nombre sospechoso; componentes de IA (modelos, MCP, plugins) sin revisar | 1104, 1357, 1395 |
| **A04** Cryptographic Failures | MD5/SHA1/DES/ECB; aleatorios no criptográficos para tokens; claves en código; datos sensibles sin cifrar en tránsito o reposo; hashing de passwords sin Argon2id/bcrypt/scrypt | 319, 326, 327, 330, 338, 916 |
| **A05** Injection | SQL/NoSQL concatenado; shell con input (`exec`, `system`, `shell=True`); `eval`; plantillas renderizadas con input; HTML sin codificar (XSS); LDAP/XPath | 20, 77, 78, 79, 89, 94 |
| **A06** Insecure Design | Flujos de negocio sin límites (abuso automatizado); uploads sin validar tipo/tamaño/destino; condiciones de carrera en saldos o inventario; privilegios mal modelados; falta de threat model en features sensibles | 269, 362, 434, 501, 522, 841 |
| **A07** Authentication Failures | Sin rate limit ni bloqueo en login; credenciales por defecto o hardcodeadas; sesiones que no expiran o no rotan tras login; recuperación de cuenta débil; validación de certificados desactivada | 287, 295, 306, 307, 384, 613, 798 |
| **A08** Software or Data Integrity Failures | Deserialización de datos no confiables; mass assignment (bindear `role`/`isAdmin` del body); código o actualizaciones descargados sin verificar integridad; cookies usadas en decisiones de seguridad sin firma | 345, 494, 502, 829, 915 |
| **A09** Security Logging and Alerting Failures | Eventos de seguridad sin registrar (login fallido, cambio de permisos, acceso denegado); secretos o PII en logs; logs inyectables (saltos de línea sin neutralizar); sin alertas sobre lo registrado | 117, 223, 532, 778 |
| **A10** Mishandling of Exceptional Conditions | `catch` vacío o que continúa; authz que concede si el check lanza (**fail-open**); valores de retorno sin comprobar; mensajes de error con internals o que permiten enumerar usuarios; recursos sin liberar en error | 209, 248, 252, 390, 476, 636, 703, 754, 755 |

## ASVS 5.0 — capítulos y cuándo aplican

Niveles: **L1** mínimo para cualquier aplicación · **L2** apps con datos sensibles (la mayoría) · **L3** máxima garantía. Cita requisitos como `V8.2.1` (capítulo.sección.requisito).

| Capítulo | Aplícalo cuando el cambio toca… |
|---|---|
| V1 Encoding and Sanitization | salida a HTML, SQL, shell, plantillas, otros intérpretes |
| V2 Validation and Business Logic | input externo, reglas de negocio, límites de flujo |
| V3 Web Frontend Security | navegador: CSP, cookies, headers, DOM, `postMessage` |
| V4 API and Web Service | endpoints REST/GraphQL/gRPC, webhooks |
| V5 File Handling | uploads, descargas, rutas de archivos, archivos comprimidos |
| V6 Authentication | login, MFA, passwords, recuperación de cuenta |
| V7 Session Management | sesiones, cookies de sesión, expiración, logout |
| V8 Authorization | permisos, roles, acceso por objeto o tenant |
| V9 Self-contained Tokens | JWT u otros tokens firmados |
| V10 OAuth and OIDC | integración como cliente, servidor de recursos o proveedor |
| V11 Cryptography | algoritmos, claves, aleatoriedad, hashing |
| V12 Secure Communication | TLS, certificados, comunicación entre servicios |
| V13 Configuration | secretos, configuración por entorno, dependencias, build |
| V14 Data Protection | datos sensibles en reposo, caché, cliente, privacidad |
| V15 Secure Coding and Architecture | diseño, componentes de terceros, concurrencia |
| V16 Security Logging and Error Handling | logs de seguridad, manejo de errores |
| V17 WebRTC | audio/video en tiempo real |

## OWASP Top 10 for LLM Applications 2026

Publicado el 4 de agosto de 2026. Cambio principal frente a 2025: *Excessive Agency* sube al #3 y *System Prompt Leakage* se amplía a *Hidden Context Exposure*.

| ID | Riesgo | Qué revisar |
|---|---|---|
| LLM01 | Prompt Injection | Texto de usuario, web, documentos o herramientas que llega al prompt; separación clara instrucciones/datos; el modelo nunca decide solo lo sensible |
| LLM02 | Sensitive Information Disclosure | PII, secretos o datos de otros tenants en prompts, contexto recuperado o respuestas |
| LLM03 | Excessive Agency | Herramientas con más permisos de los necesarios; acciones irreversibles sin confirmación humana |
| LLM04 | Supply Chain | Modelos, datasets, plugins y SDKs de terceros sin verificar ni fijar versión |
| LLM05 | Data and Model Poisoning | Datos de entrenamiento, fine-tuning o RAG que un tercero puede escribir |
| LLM06 | Unbounded Consumption | Sin límite de tokens, llamadas, costo o tamaño de entrada por usuario |
| LLM07 | Misinformation | Respuestas usadas como hechos sin verificación ni citas en flujos críticos |
| LLM08 | Hidden Context Exposure | System prompt, instrucciones, esquemas de herramientas o datos de perfil extraíbles; no guardes secretos ahí |
| LLM09 | Vector and Embedding Weaknesses | RAG sin control de acceso por documento; mezcla de tenants en el índice |
| LLM10 | Improper Output Handling | Salida del modelo usada en SQL, shell, HTML, rutas o llamadas sin validar como input externo |

## OWASP Top 10 for Agentic Applications 2026

Publicado el 9 de diciembre de 2025. Aplica a agentes, herramientas y servidores MCP del producto, y también al propio uso de agentes de código en el repo.

| ID | Riesgo | Qué revisar |
|---|---|---|
| ASI01 | Agent Goal Hijack | Contenido leído (issues, web, archivos) que cambia el objetivo del agente |
| ASI02 | Tool Misuse and Exploitation | Herramientas permitidas usadas en bucle, encadenadas de forma insegura o en volumen |
| ASI03 | Agent Identity and Privilege Abuse | El agente actúa con credenciales amplias o heredadas; acciones sin atribución clara |
| ASI04 | Agentic Supply Chain Compromise | Herramientas, servidores MCP, plugins, skills o prompts de terceros sin revisar ni fijar |
| ASI05 | Unexpected Code Execution | Código generado o descargado que se ejecuta sin aislamiento ni revisión |
| ASI06 | Memory and Context Poisoning | Memoria persistente que acepta contenido no verificado y guía decisiones futuras |
| ASI07 | Insecure Inter-Agent Communication | Mensajes entre agentes sin autenticar ni validar |
| ASI08 | Cascading Agent Failures | Un fallo se propaga por herramientas y agentes sin cortafuegos ni límites |
| ASI09 | Human-Agent Trust Exploitation | Salidas convincentes que la persona aprueba sin verificar |
| ASI10 | Rogue Agents | Agentes que actúan fuera de su alcance previsto y nadie lo detecta |

## Otros estándares por tipo de proyecto

- **APIs**: OWASP API Security Top 10 **2023** (edición vigente) — lo aplica a fondo el agente `api-security-audit`.
- **Móvil**: OWASP **MASVS v2** — `MASVS-STORAGE`, `MASVS-CRYPTO`, `MASVS-AUTH`, `MASVS-NETWORK`, `MASVS-PLATFORM`, `MASVS-CODE`, `MASVS-RESILIENCE`, `MASVS-PRIVACY`.
- **Pruebas**: OWASP WSTG para casos de prueba manuales (pentest autorizado, agente `penetration-tester`).

## Fuentes
- OWASP Top 10:2025 — https://top10.owasp.org/2025/
- CWE Top 25 (2025) — https://cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html
- OWASP ASVS 5.0 — https://github.com/OWASP/ASVS/tree/master/5.0/en
- OWASP Top 10 for LLM Applications — https://genai.owasp.org/llm-top-10/
- OWASP Top 10 for Agentic Applications 2026 — https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- OWASP MASVS — https://mas.owasp.org/MASVS/
- OpenSSF, guía de instrucciones seguras para asistentes de código — https://best.openssf.org/Security-Focused-Guide-for-AI-Code-Assistant-Instructions
