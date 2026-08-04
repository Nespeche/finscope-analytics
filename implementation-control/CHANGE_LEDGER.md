# Change Ledger — FinScope Analytics

## 2026-08-03 — B21 closure request parser remediation candidate

- La autorización de cierre previa queda consumida; `b21-clean-completed-package-remediation` vuelve exclusivamente a `candidate/NOT_REQUESTED`, sin candidato ni cierre cargados.
- Se preservan como evidencia histórica no promovible del commit `787e79c55b2db7b831589e5e9d5cbd8c64fcb5a9`: Closure Validation run `30838147836`, artifact `8865666079` (`finscope-closure-787e79c55b2d-_FAILED`, `sha256:a871fe85f1cf586ae19fc815f6a67b343fc83a7b5a421f8f1dcde2e242f2c5bd`) por `REMEDIATION_CLOSURE_ALLOWLIST_VIOLATION:mplementation-control/CHANGE_LEDGER.md`; y PR Validation run `30838147170`, artifact `8865666299` (`finscope-github-validation-787e79c55b2d-_FAILED`, `sha256:16277122e898c0bded1bb9f345008d27432e76510b3130cee1dbff7294aa3bfe`) por fixture de batch closure acoplada al estado mutable de remediación.
- La recopilación de paths de cierre usa salidas Git NUL-delimited sin `trim`, conserva el primer carácter, incorpora tracked/staged/unstaged/untracked, deduplica y ordena determinísticamente.
- Los tests de routing aíslan el handoff de batch y conservan la serialización fail-closed ante una remediación `closure/PENDING`; el verificador de cierre promueve la causa real de apply y conserva `APPLY_CONTEXT_MISSING` como detalle secundario con logs sanitizados, acotados y manifestados.
- B21 permanece `COMPLETED`; B22 permanece `PENDING` y no iniciado; `activeBatchId=B22`; `nextAuthorizedBatchId=B22`; `convergenceAuthorized=false`; producto y `.specify` no cambian.

## 2026-08-03 — B21 evidence schema remediation r2

- Se conserva como `REJECTED_EVIDENCE_SCHEMA_INVALID` el artifact `8858252413` del commit `e6d71f7785ac7efab4375366526f2f206969dea9`; no es promovible.
- `commandResult.required` queda declarado y obligatorio sin relajar `additionalProperties=false`.
- El validador dependency-free resuelve JSON Pointer local fail-closed, detecta referencias ausentes y ciclos, y se contrasta con Ajv Draft 2020-12 sobre los bytes finales antes del manifest.
- B21 y T001–T095 permanecen `COMPLETED`; B22 permanece `PENDING` y no iniciado; `.specify` no cambia.

## v0.21.1 — Preparación de orquestación de implementación

- Baseline fuente: `FinScope_Analytics_SpecDev_ChatGPT_v0.21_post_analysis_remediated.zip`.
- SHA-256 fuente: `2e765125d2d3415f9804a0bd8c30f1d9073eb9ae2576ff573c58c4706065e425`.
- Tipo de cambio: adaptación documental operativa; sin código de producto.
- Añadidos: protocolo, política de contexto, mapa de 25 lotes, estado inicial, schemas operativos, plantilla de handoff, plantilla de reporte y prompt por lotes.
- Modificados: entrada/contexto/índice/gate/metadata, prompt de implementación, informe derivado de consistencia y artefactos de empaquetado.
- Corregido: conteo derivado `24 fundamentales + 8 precio = 32`.
- Sin cambios: `.specify`, Constitución 3.1.0, `spec.md`, `plan.md`, contenido de T001–T109, contratos, schemas de producto, catálogos, mappings y fixtures.
- Estado: `READY_FOR_BATCH_B01`.

## v0.21.1 — Ejecución parcial del lote B01

- Baseline de entrada exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.1_implementation_orchestration_ready.zip`.
- SHA-256 de entrada verificado: `7b1b9feea5e80a02a417f1a5905375931b124613f8cdfef244fd573f13067186`.
- Lote ejecutado: `B01`; tareas limitadas a `T001`, `T002`, `T003`, `T005`, `T006` y `T010`.
- Implementado: manifiesto de dependencias exactas y licencias, TypeScript estricto, Vite/Svelte SPA mínima, arnés Vitest determinístico, perfiles Playwright desktop/móvil, helper axe suplementario y documentación Windows/VS Code.
- Bloqueante: el registro npm devolvió HTTP 503 y la salida directa al registro público no estuvo disponible; no se generó un lockfile incompleto ni se simuló un PASS.
- Estado: `PARTIAL`; las seis tareas permanecen `BLOCKED` y sin casilla `[X]`.
- Continuidad: `activeBatchId=B01`, `nextAuthorizedBatchId=B01`; `B02` no fue iniciado ni autorizado por esta ejecución.
- Pruebas suplementarias: compilación TypeScript aislada y validaciones estructurales PASS; 132 JSON, 2 YAML y 30 schemas válidos.
- `.specify`: 19/19 archivos byte-idénticos; hash operativo preservado `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Sin artefactos regenerables: no `node_modules`, `dist`, `.wrangler`, caches, reportes Playwright ni archivos temporales.

## v0.21.1_B01_partial_r2 — Segunda reanudación bloqueada del lote B01

- Baseline de entrada exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.1_B01_partial.zip`.
- SHA-256 de entrada verificado: `e15efa401327551eaab45ff21a976ae5a93d89ba0c3b7aaa051e932b63b93038`.
- Integridad, gates, toolchain del host y `.specify` verificados antes de ejecutar.
- Generación de lockfile reintentada con npm `10.9.2`: `BLOCKED` por `E503`; no se generó ni fabricó `package-lock.json`.
- Comandos obligatorios ejecutados: `npm ci`, `npm run typecheck`, `npm run test:contract`, `npm run test`, `npm run build` y carga/listado Playwright; todos registraron fallo por ausencia del lockfile/árbol pinneado.
- Tareas `T001`, `T002`, `T003`, `T005`, `T006` y `T010`: continúan `BLOCKED` y sin casilla `[X]`.
- Estado de continuidad: `PARTIAL`, `activeBatchId=B01`, `nextAuthorizedBatchId=B01`; B02 no iniciado y convergencia cerrada.
- Sin cambios de producto en esta reanudación; solo se actualizaron estado, informe, ledger y artefactos de empaquetado.
- `.specify`: 19/19 archivos byte-idénticos; hash preservado `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.

## v0.21.1_B01_completed — Cierre aprobado del lote B01

- Baseline de entrada exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.1_B01_partial_r2.zip`.
- SHA-256 de entrada verificado: `f0f9b95dbefd46727cf7c8d7831b02e5068a747317000653fdcfb8406787bd20`.
- Hallazgo `B01-F001`: cerrado; el registro npm respondió y se generó el lockfile completo.
- `npm ci`, typecheck, 10 pruebas Vitest, build y carga/listado Playwright/accesibilidad: `PASS`.
- Correcciones compatibles con TypeScript 7 y Playwright 1.61.1 aplicadas en configuraciones autorizadas del lote.
- Tareas `T001`, `T002`, `T003`, `T005`, `T006` y `T010`: `COMPLETED` y marcadas `[X]`.
- Estado: `implementationStatus=IN_PROGRESS`, `activeBatchId=B02`, `nextAuthorizedBatchId=B02`; B02 no ejecutado.
- `.specify`: 19/19 archivos byte-idénticos; hash preservado `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Paquete entregable: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.1_B01_completed.zip` y sidecar SHA-256.

## v0.21.2_authority_alignment_ready — Auditoría y remediación transversal

- Baseline inmediato exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.1_B01_completed.zip`.
- SHA-256 verificado: `487cb0e7ba76a8133c521a470b9a09856034ea6c439dc5fc8ee6132118d879e1`.
- Integridad de entrada: sidecar/CRC/raíz única/extracción segura/rutas/case-fold PASS.
- Diagnóstico inicial: 1 BLOCKER, 8 HIGH y 8 MEDIUM; causa central: autoridad plana y tareas documentalmente definidas pero no necesariamente alcanzables desde entrypoints/runners.
- Corregido: autoridad por campo, estado raíz obsoleto, DAG dependiente de T001, alcance imposible de T004, composition roots browser/Worker/gateway, test discovery, política Ajv y validación local delegada.
- Añadido: `AUTHORITY_MATRIX.json`, `TASK_SOURCE_LOCK.json`, AUTH-036, schemas operativos, comandos por lote, script PowerShell y reportes v0.21.2.
- Conservado: 109 tareas, 25 lotes, B01 `COMPLETED`, B02 único autorizado, B03 no iniciado y `convergenceAuthorized=false`.
- `.specify`: byte-inmutable; hash esperado `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Limitación histórica explícita: el ZIP bruto de evidencia B01 no estaba incorporado al baseline de entrada; se preserva su hash y no se fabrica.
- Estado de salida: baseline completado de remediación documental/operativa, listo para ejecutar exclusivamente B02.

## v0.21.2_B02_local_validation_candidate_r1 — Autoría de B02 pendiente de validación

- Baseline de entrada exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_authority_alignment_ready.zip`.
- SHA-256 verificado: `811436f2e00c34e78ff0a547c6e5364ed518ad40475304aca121399e52fde1d9`.
- Alcance exclusivo: T004, T007, T008, T009 y T012; no se inició B03 ni convergencia.
- Implementado: shell Svelte montado y composición tipada; Worker SEC read-only y binding D1; migración compacta e inmutable; headers/fallback estáticos; registry de 26 schemas y Ajv2020 fail-closed; pruebas contract/integration/E2E del lote.
- Reconciliación de autoridad: `tasks.md` prevaleció sobre la omisión de `public/_headers` y `public/_redirects` en el mirror B02; se actualizó el mirror y su lock sin modificar la tarea normativa.
- Evidencia auxiliar: sintaxis TypeScript 12/12 PASS; strict source check PASS; migración SQLite PASS; 26 positivos/25 negativos Draft 2020-12 PASS; checks estructurales 28/28 PASS.
- Bloqueante: `npm ci` recibió HTTP 503 y no pudieron ejecutarse typecheck oficial, Vitest, Svelte compiler, Playwright/Chromium ni build; no se fabricó PASS.
- Estado: cinco tareas `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; `activeBatchId=B02`; B03 `PENDING`; `convergenceAuthorized=false`.
- `.specify`: 19/19 archivos deben permanecer byte-idénticos; ninguna casilla de B02 fue marcada `[X]`.
- Entrega: candidato completo + sidecar; se adjunta al chat de validación y no reemplaza Fuentes del Proyecto.

## v0.21.2_B02_local_validation_candidate_r2 — Remediación de validación local

- Entrada inmediata: candidato r1 y evidencia diagnóstica local aportada por el usuario.
- r1: `npm ci` y la instalación de Chromium alcanzaron el paso siguiente; `npm run typecheck` falló con TS2339 en los dos usos de `import.meta.glob`.
- Causa: no se cargaba la ampliación oficial `vite/client` de `ImportMeta`; se añadió la referencia dentro de `src/app/composition.ts`, archivo autorizado por T004.
- Infraestructura: se eliminó el uso de `System.IO.Path.GetRelativePath`, incompatible con Windows PowerShell 5.1; se corrigió el comodín de `Compress-Archive` y se añadió impresión de stdout/stderr en fallos requeridos.
- No se modificaron tareas, requisitos, batch B02, contratos normativos ni `.specify`.
- Estado: T004/T007/T008/T009/T012 siguen `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; B03 `PENDING`; convergencia cerrada.
- Entrega: candidato r2 completo + sidecar; debe validarse desde extracción limpia y no reemplaza Fuentes del Proyecto.

## v0.21.2_B02_local_validation_candidate_r3 — Remediación a11y y hash canónico

- Entrada: candidato r2 verificado + evidencia local B02 del 2026-07-22.
- Evidencia r2: npm ci, Chromium, typecheck e integración PASS; contrato Svelte FAIL por `a11y_no_noninteractive_tabindex` en `AppStatus.svelte`.
- T004: `tabindex="0"` reemplazado por `tabindex="-1"`; contrato Svelte ahora descubre recursivamente todos los `src/app/**/*.svelte`; E2E alinea la expectativa de foco.
- Validación local: hash `.specify` reemplazado por serialización canónica cross-PowerShell; chequeo previo de `activeBatchId`; logs mostrados como UTF-8.
- `.specify`: 19/19 archivos byte-idénticos; hash canónico preservado `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Estado: T004/T007/T008/T009/T012 `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; B03 `PENDING`; convergencia cerrada.
- Entrega: candidato r3 completo + sidecar; no reemplaza Fuentes del Proyecto.

## v0.21.2_B02_local_validation_candidate_r4 — Remediación del plano de control

- Baseline normativo activo verificado: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_authority_alignment_ready.zip`, SHA-256 `811436f2e00c34e78ff0a547c6e5364ed518ad40475304aca121399e52fde1d9`.
- Entrada inmediata: candidato r3, SHA-256 `af3e44f115606aaf1262d4ede0dc07b406327b94495390f9907f518bced54cb4`, y evidencia local del 2026-07-22.
- r3 rechazado para cierre: npm ci, Chromium, typecheck, integración, contratos B02 y E2E PASS; regresión Vitest FAIL en `test-discovery.test.ts`.
- Causa raíz: la prueba confundía propiedad compartida con conflicto; T007/T028, T021/T072 y T028/T035 reutilizan rutas con un único runner compatible.
- Discovery remediado: múltiples tareas por ruta permitidas con un mismo runner; conflicto solo ante runners incompatibles; casos positivos y negativos agregados.
- B02-R001 remediado: gate schema alineado a `V0.21_PHASE_STATUS.md#gate`; traceability schema alineado a versión `5.0.4`.
- Schema registry ampliado para compilar schemas y validar realmente los dos documentos positivos.
- Protocolos actualizados con autovalidación obligatoria del plano de control; B02 añade `test-control-plane` antes de las regresiones restantes.
- No se reimplementó B02, no se inició B03, no se ejecutó convergencia y no se modificaron `.specify`, `spec.md` ni `tasks.md`.
- Validación estática r4 PASS; `npm ci` local no pudo completarse por HTTP 503, por lo que no se fabrica ningún PASS ejecutable r4.
- Estado preservado: T004/T007/T008/T009/T012 `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; B03 `PENDING`; `convergenceAuthorized=false`.
- Entrega: candidato r4 completo + sidecar para validación externa; no reemplaza Fuentes del Proyecto.

## v0.21.2_B02_local_validation_candidate_r5 — Revisión de evidencia r4 y remediación browser/procedencia

- Baseline normativo activo exclusivo verificado: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_authority_alignment_ready.zip`, SHA-256 `811436f2e00c34e78ff0a547c6e5364ed518ad40475304aca121399e52fde1d9`.
- Entrada inmediata verificada: candidato r4 SHA-256 `4a4b05d04f2296e98d96511756e067cb8a876db2960e9f4dbc034593c45f1073` y evidencia local SHA-256 `06578978ccb79cf162f9d6d8fa241e55b2be8c593efc7f719ff742d747d1e417`.
- La evidencia r4 pertenece al árbol r4 por `.specify`, `tasks.md` y 20 hashes objetivo, pero su resultado interno es `FAIL`; `regression-browser` termina exit `1`, build queda `NOT_RUN` implícito y faltan identidad del ZIP y versiones del entorno.
- Causa raíz browser: `test:browser` encadenaba categorías sin specs ejecutables; accesibilidad devolvía `No tests found` y evitaba performance/browser y build. El agregador ahora ejecuta una sola discovery `playwright test` sin `--pass-with-no-tests`.
- Causa independiente E2E: el producto cartesiano proyecto/viewport generaba dos `test.skip`; el shell ahora corre una vez por proyecto, espera 2 PASS y 0 skipped.
- Evidencia 1.1.0: ZIP/sidecar y extracción ligados criptográficamente; entorno, tiempos, exit codes reales, logs y hashes registrados; comandos posteriores quedan `NOT_RUN`; un exit real 0 se clasifica `FAIL` si el runner informa cero tests o skipped/pending/todo.
- Plano de control: regresiones contractuales cubren agregación Playwright, ausencia de skip, políticas del script, compilación/validación de siete schemas operativos, falsos PASS, integridad falsa y `NOT_RUN` sin razón.
- Validación estática de autoría: JSON/JSONC/YAML, schemas/documentos operativos, lock de 109 tareas/25 lotes, DAG, sintaxis TypeScript, schema de evidencia y análisis léxico PowerShell PASS.
- Tres intentos exactos de `npm ci` quedaron bloqueados por HTTP 503 al descargar `zimmerframe-1.1.4.tgz`; DNS directo a registries públicos tampoco estuvo disponible. No se ejecutaron sobre un árbol incompleto typecheck, Vitest, Playwright, build ni PowerShell y no se fabricó PASS.
- Estado preservado: T004/T007/T008/T009/T012 `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; `activeBatchId=B02`; B03 `PENDING`; `convergenceAuthorized=false`.
- `.specify`, `spec.md` y `tasks.md` permanecen byte-inmutables; T007, T008, T028 y sus referencias compartidas permanecen intactos.
- Entrega: candidato r5 completo + sidecar para validación local desde extracción limpia; no reemplaza Fuentes del Proyecto.

## v0.21.2_B02_local_validation_candidate_r6 — Auditoría completa, SDD/contexto y ejecutabilidad

- Baseline completado activo verificado: `authority_alignment_ready`, SHA-256 `811436f2e00c34e78ff0a547c6e5364ed518ad40475304aca121399e52fde1d9`.
- Candidato r5 y sidecar verificados; el usuario informó PASS del script integral, pero el bundle de evidencia no fue adjuntado y no se promovió por inferencia.
- Auditoría estructural aplicada a todo el árbol; lectura semántica integral de entradas, autoridades, gates, control plane, código, pruebas y reportes activos.
- Remediado falso positivo de typecheck: el proyecto Worker ahora incluye `workers/sec-gateway/src/**/*.ts`; `tsc` del gateway PASS en el entorno de auditoría.
- Remediada composición AUTH-027: componentes ordinarios no se auto-renderizan; cinco placements, plugins lifecycle/a11y y estilos quedan alcanzables sin editar futuros entrypoints.
- Remediado contrato de discovery: el script PowerShell leído por la prueba ahora tiene aserciones de política reales.
- Alineados `plan.md`, phase status y documentación de desarrollo con el gate/estado activos y la ubicación externa de evidencia.
- Añadidos modelo operativo SDD, modelo de mantenimiento de contexto, handoff ampliado y auditoría completa por archivo.
- No se eliminó código: scaffolding, helpers, dependencias futuras, infraestructura upstream e históricos fueron clasificados para evitar falsos positivos de “dead code”.
- `.specify`, `spec.md` y `tasks.md` permanecen byte-inmutables; B03/convergencia no iniciados.
- Estado: T004/T007/T008/T009/T012 `IMPLEMENTED_PENDING_VALIDATION`; B02 `LOCAL_VALIDATION_REQUIRED`; candidato r6 requiere validación completa nueva.

## v0.21.2_B02_completed — Cierre aprobado del lote B02

- Candidato r6 SHA-256: `e784878578255b6a36fd67345b184a670b7633856a2fadee799ad34674bc30d6`.
- Evidencia externa SHA-256: `81a40f36a2cdd1aec675ad622989165ce670ae245223b9af44313840897cb0ca`; schema 1.1.0; diez comandos `PASS`, exit code `0`.
- T004, T007, T008, T009 y T012: `COMPLETED` y `[X]`.
- B02: `COMPLETED`; B03: `PENDING`, `activeBatchId=B03`, `nextAuthorizedBatchId=B03`.
- Regresión: control plane 14 tests, contratos B02 22, integración 2, Vitest 38, Playwright desktop/mobile 2, browser 2 y build PASS.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, schemas, scripts, dependencias, fixtures, FR/NFR/AC, Constitución o `.specify`.
- Paquete entregable: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_completed.zip` y sidecar SHA-256.
- Convergencia permanece cerrada.

## v0.21.3_B02_control_plane_hardening_candidate_r1 — Corrección raíz lock/mirrors y extracción automática

- Baseline fuente exclusivo: `v0.21.2_B02_completed`, SHA-256 `ac1078c9da0c5cd12d066683eb74d70ca6f2788cb0adc136e6bb13d0e236ab9a`.
- Diagnóstico: 109 hashes de tarea, DAG, mapa, estado y gates correctos; 25 hashes full-file de batches obsoletos en `TASK_SOURCE_LOCK.json`.
- Recalculados B01–B25 y añadido validador fail-closed más prueba contractual.
- Endurecido el validador por lote con binding lógico del sidecar y preflight `TASK_MIRROR_MISMATCH`.
- Añadido validador externo autocontenido con inspección previa, extracción automática limpia, tolerancia a sufijos físicos `(1)`, ocho comandos obligatorios y evidencia ZIP schema-validada.
- Instrucciones del Proyecto actualizadas sin superar 8.000 caracteres; `.specify`, `spec.md`, `tasks.md`, FR/NFR/AC y producto permanecen inmutables.
- Estado: candidato `LOCAL_VALIDATION_REQUIRED`; B03 `PENDING` no iniciado; baseline B02 completado no se reemplaza hasta evidencia externa verificada.

## v0.21.3_B02_control_plane_hardening_completed — Promoción verificada del hardening del plano de control

- Candidato exacto: SHA-256 `4da4412b15630093bad16328cff5beb76d9c38868dfa6df06cc1a95dfb2c4006`; sidecar, CRC, raíz, extracción, manifiesto, inventario y metadata verificados.
- Evidencia exacta: `FinScope_control_plane_evidence_20260723-222845.zip`, SHA-256 `f346f87204842dff8cebb5ac51ae25b7ce07c81b4c5a0c82c822e91698914d0f`; ocho comandos obligatorios `PASS`, cero `FAIL` y cero `NOT_RUN`.
- Plano de control: 991/991 checks; 109 tareas, 25 lotes y 61/61 controles independientes; cuatro mutaciones deliberadas rechazadas fail-closed.
- Cierre `AUD-R6-003`; permanecen diferidos `AUD-R6-004`, `CFG-R6-001` y la revisión npm de T098/B22.
- Excepción de cierre aplicada mediante allowlist; no se modificaron código, tests, runners, scripts, schemas, dependencias, fixtures, `.specify`, `spec.md`, `tasks.md` ni comportamiento.
- Estado: B01/B02 `COMPLETED`; B03 `PENDING`, `activeBatchId=B03`, `nextAuthorizedBatchId=B03`; `convergenceAuthorized=false`.
- Entregable: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_completed.zip` y sidecar SHA-256 externo.

## v0.21.4_B03_local_validation_candidate_r1 — Implementación B03 pendiente de validación local

- Baseline de entrada exclusivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_completed.zip`.
- SHA-256 de entrada verificado: `64e41940d238f74d296793aaeb13f556b5d0cc3613f15723dc1788bd7f7b11a1`.
- Alcance exclusivo: T011, T013, T014, T015 y T016; B04 y convergencia no iniciados.
- Implementado: DecimalString/decimal.js half-even; JCS y SHA-256; reloj inyectado y tiempo de presentación explícito; loaders de autoridad fail-closed; mensajes UI↔Worker exhaustivos y detección de IDs duplicados.
- Preflight: integridad física PASS; 19 archivos `.specify` con hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`; 109 tareas y 25 lotes coherentes; plano de control inicial 991/991 PASS.
- Bloqueante ambiental: `npm ci` exit code 1 por HTTP 503 de `zimmerframe-1.1.4.tgz`; los comandos normativos dependientes quedaron `NOT_RUN` por fail-fast.
- Evidencia auxiliar: validación TypeScript estricta con stubs externos, sintaxis y vectores runtime independientes PASS; no sustituyen typecheck/Vitest/build.
- Estado: tareas `IMPLEMENTED_PENDING_VALIDATION`; B03 `LOCAL_VALIDATION_REQUIRED`; casillas abiertas; `activeBatchId=B03`; B04 `PENDING`; `convergenceAuthorized=false`.
- Entrega: candidato completo `FinScope_Analytics_SpecDev_ChatGPT_v0.21.4_B03_local_validation_candidate_r1.zip` y sidecar externo; no reemplaza el baseline activo en Fuentes.

## v0.21.4_B03_local_validation_candidate_r2 — Remediación TypeScript 7 BufferSource en T013

- Entrada inmediata: candidato r1 SHA-256 `fd002062b399c3160b5ed56b3edc313d831154c1a7ace5e1891168435835e36d`.
- La ejecución local r1 con PowerShell 7 completó `npm ci` y falló en `npm run typecheck` con TS2345 en `src/core/sha256.ts:27`; los pasos restantes quedaron `NOT_RUN` por fail-fast.
- Causa raíz: `Uint8Array` sin parámetro se amplía a `Uint8Array<ArrayBufferLike>` y puede estar respaldado por `SharedArrayBuffer`; Web Crypto `SubtleCrypto.digest` exige un `BufferSource` respaldado por `ArrayBuffer`.
- T013 remediado sin casts: `toBytes` devuelve `Uint8Array<ArrayBuffer>` y copia entradas binarias mediante `Uint8Array.from(input)`.
- Añadida regresión de SHA-256 con una vista respaldada por `SharedArrayBuffer`; digest conocido de `abc` PASS en verificación auxiliar.
- No se modificaron `.specify`, Constitución, phase status, `spec.md`, `tasks.md`, FR/NFR/AC, decisiones, contratos, schemas, catálogos, fixtures ni lotes futuros.
- Estado preservado: T011/T013/T014/T015/T016 `IMPLEMENTED_PENDING_VALIDATION`; B03 `LOCAL_VALIDATION_REQUIRED`; B04 `PENDING`; convergencia cerrada.
- Entrega: candidato r2 completo + sidecar; requiere evidencia nueva y no reemplaza Fuentes del Proyecto.
## v0.21.4_B03_local_validation_candidate_r3 — Remediación semántica de fixture negativo en T011

- Entrada: candidato r2 y evidencia `FinScope_local_evidence_B03_20260724-083533.zip` verificada, vinculada al SHA-256 r2.
- Evidencia: `npm ci` PASS, typecheck PASS, unit aggregate FAIL en `NEG-EXTRA-PROPERTY`; contrato, regresión y build `NOT_RUN` por fail-fast.
- Causa raíz: `tests/unit/core/decimal.test.ts` ignoraba `expectedFailure` y trataba siete casos heterogéneos como fallos de `DecimalString`.
- Corrección: filtrar por `expectedFailure === DecimalString` y exigir exactamente los tres IDs de fallo léxico.
- Preservado: fixtures, schemas, contratos, autoridades, `.specify`, `spec.md`, `tasks.md`, B03 `LOCAL_VALIDATION_REQUIRED`, B04 `PENDING` y convergencia cerrada.
- Entrega: candidato r3 completo + sidecar; requiere evidencia nueva y no reemplaza Fuentes del Proyecto.



## v0.21.4_B03_local_validation_candidate_r4 — Hardening de extracción Windows

- Entrada inmediata: candidato r3 sin evidencia ejecutable, debido a fallo de extracción previo a la validación.
- Diagnóstico: Explorer `0x80010135` por la combinación de un nombre externo largo y rutas internas; el bloque manual de VS Code apuntó además a `C:\FinScope\B03-r3\...`, aunque los archivos estaban bajo `C:\FinScope\FinScope_Analytics_...`.
- Producto y tests: byte-idénticos a r3; no se modificaron tareas, batch, schemas, fixtures, contratos, FR/NFR/AC ni `.specify`.
- Corrección: archivo físico `FS_B03_r4.zip`, sidecar `FS_B03_r4.zip.sha256`, raíz recomendada `C:\FS\B03r4` y lanzador externo reutilizable con verificación SHA-256 y extracción segura.
- Estado: B03 `LOCAL_VALIDATION_REQUIRED`; T011/T013/T014/T015/T016 `IMPLEMENTED_PENDING_VALIDATION`; B04 `PENDING`.
- Entrega: candidato r4 completo + sidecar + lanzador; no reemplaza Fuentes del Proyecto.

## v0.21.4_B03_completed — Cierre aprobado del lote B03

- Baseline de entrada: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_completed.zip`, SHA-256 `64e41940d238f74d296793aaeb13f556b5d0cc3613f15723dc1788bd7f7b11a1`.
- Candidato exacto: `FS_B03_r4.zip`, SHA-256 `a70a2c77e854b18ff9d3d8e606467ec8a07c6206043052f89e1eba9168d82707`; sidecar, CRC, raíz única, extracción segura, manifiesto, inventario y metadata PASS.
- Evidencia externa: `FinScope_local_evidence_B03_20260724-093953.zip`, SHA-256 `9cd4acfc988be65a37ca035cf3aaaa32107c40ce7432251927a1f3bb128b212b`; schema 1.1.0 y seis comandos obligatorios PASS/exit 0.
- Unit B03: 4 archivos/21 tests; contrato: 1/6; regresión Vitest: 16/66; build: 115 módulos, 3 assets, 500951 bytes.
- T011, T013, T014, T015 y T016: `COMPLETED` y `[X]`; B03 `COMPLETED`.
- B04: `PENDING`, no iniciado, `activeBatchId=B04`, `nextAuthorizedBatchId=B04`; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- `.specify`: 19/19 byte-idénticos; hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Entregable físico corto: `FS_v0.21.4_B03_completed.zip` y sidecar `FS_v0.21.4_B03_completed.zip.sha256`.

## v0.21.5_B04_local_validation_candidate_r1 — Implementación B04 pendiente de validación local

- Baseline de entrada exclusivo: `FS_v0.21.4_B03_completed.zip`, SHA-256 `f68f654ea7c129d242fa73afc24d788db826f079719ac1edacaff06436cf2c4c`.
- Preflight físico y normativo PASS: CRC, raíz única, extracción segura, Windows, UTF-8, JSON/YAML, schemas operativos, manifiesto/inventario, 109 hashes de tareas, 25 hashes de batches y plano de control inicial 993/993.
- Alcance exclusivo implementado: T017 matriz de 81 pares y capacidades; T018 frontera local/HTTP; T019 telemetría redactada de tres campos; T020 records readonly y separación fundamental/precio.
- Creado `implementation-control/RECOMMENDED_IMPROVEMENTS.md` como registro informativo no normativo; primera entrada `IMP-001`, estado `OPEN`. No se modificó el protocolo de validación ni comportamiento ejecutable para atenderla.
- No se modificaron `.specify`, Constitución, phase status, `spec.md`, `tasks.md`, FR/NFR/AC, decisiones, contratos, schemas, fixtures, runners, scripts ni dependencias.
- Las validaciones npm fueron delegadas expresamente: T017–T020 quedan `IMPLEMENTED_PENDING_VALIDATION`; B04 queda `LOCAL_VALIDATION_REQUIRED`; casillas abiertas; B05 `PENDING`; convergencia cerrada.
- Candidato físico previsto: `FS_B04_r1.zip`, sidecar externo y lanzador `Run-FinScope-BatchValidation.ps1`; requiere evidencia nueva del candidato exacto.

## v0.21.5_B04_local_validation_candidate_r2 — Remediación del contrato dinámico del plano de control

- Entrada inmediata verificada: `FS_B04_r1.zip`, SHA-256 `8bb7d4785d4365f011a0471381cca23d79ed2236e4b6e9ff9080666b1188edf0`, y evidencia `FinScope_local_evidence_B04_20260725-104454.zip`, SHA-256 `d2e965c5cf24f2fc5f71d8098998169063c24fc71c1c3fd8af21d2b6aeedc58d`.
- r1: `npm ci`, typecheck y las pruebas específicas B04 PASS; regresión Vitest FAIL únicamente en `control-plane-integrity.test.ts`; build `NOT_RUN` por fail-fast.
- Causa raíz: el contrato fijaba `checkCount=991`, valor válido para B03 con cuatro dependencias externas. B04 tiene seis dependencias y el validador correcto produce 993 checks PASS.
- Corrección: eliminar el total literal y verificar invariantes semánticas —PASS, cero issues/fallos, conteos internos coherentes, IDs únicos y todas las comprobaciones PASS—.
- No modificado: validador, scripts, schemas, runners, dependencias, fixtures, gates, `tasks.md`, FR/NFR/AC, decisiones, `.specify` y código funcional T017–T020.
- Registro: `IMP-002` añadido como `IN_PROGRESS`; solo evidencia ejecutable PASS de r2 permitirá marcarlo `RESOLVED`.
- Estado preservado: T017–T020 `IMPLEMENTED_PENDING_VALIDATION`; B04 `LOCAL_VALIDATION_REQUIRED`; B05 `PENDING`; `convergenceAuthorized=false`.
- Entrega: candidato r2 completo + sidecar + lanzador externo; r1 y su evidencia FAIL no reemplazan el baseline B03.

## v0.21.5_B04_completed — Cierre aprobado del lote B04

- Baseline de entrada: `FS_v0.21.4_B03_completed.zip`, SHA-256 `f68f654ea7c129d242fa73afc24d788db826f079719ac1edacaff06436cf2c4c`.
- Candidato exacto: `FS_B04_r2.zip`, SHA-256 `25382901dbd792c777d32eac7beab7c7bb6072578f576a7d09ac52a249a20501`; sidecar, CRC, raíz única, extracción segura, manifiesto, inventario y metadata PASS.
- Evidencia externa: `FinScope_local_evidence_B04_20260725-115856.zip`, SHA-256 `7477c4d05c983411245735ae77f25165c82dbe696e787e330c42fe111f065892`; schema 1.1.0 y siete comandos obligatorios PASS/exit 0.
- Unit B04: 2 archivos/8 tests; contrato: 1/4; negativa: 1/4; regresión Vitest: 20/82; build: 115 módulos, 3 assets, 500951 bytes.
- T017, T018, T019 y T020: `COMPLETED` y `[X]`; B04 `COMPLETED`.
- `IMP-002` marcado `RESOLVED`; `IMP-001` permanece `OPEN`.
- B05: `PENDING`, no iniciado, `activeBatchId=B05`, `nextAuthorizedBatchId=B05`; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- Entregable físico corto: `FS_v0.21.5_B04_completed.zip` y sidecar `FS_v0.21.5_B04_completed.zip.sha256`.

## v0.21.6_B05_local_validation_candidate_r1 — Implementación B05 pendiente de validación local

- Baseline exclusivo verificado: `FS_v0.21.5_B04_completed.zip`, SHA-256 `c7491391acda2aee2daee3d43f3b177285df32342d0146645bf499de1c3a3e06`, con nombre lógico de sidecar correcto y una única pareja activa.
- Preflight físico/normativo PASS: CRC, raíz única, extracción segura, Windows, symlinks/colisiones/ZIPs anidados, UTF-8, JSON/YAML, schemas, metadata, inventario, manifiesto, 19 archivos `.specify` y plano de control inicial 995/995.
- Alcance exclusivo implementado en orden: T021 IndexedDB/consentimientos; T022 primitivas Svelte accesibles; T023 registro y orquestador Worker. B06 no fue cargado ni iniciado.
- Controles auxiliares PASS: TypeScript estricto de runtime y harness de defaults de consentimiento/coalescencia/cancelación. No sustituyen los comandos autoritativos.
- `IMP-001` ampliado sin duplicarlo: stdout/stderr separados, JSON exclusivamente desde stdout, nombres versionados, prohibición de genéricos, sidecar y bundle de runner; estado preservado `OPEN`.
- Estado: T021/T022/T023 `IMPLEMENTED_PENDING_VALIDATION`; B05 `LOCAL_VALIDATION_REQUIRED`; casillas abiertas; `activeBatchId=B05`; `nextAuthorizedBatchId=B05`; B06 `PENDING`; `convergenceAuthorized=false`.
- Entrega física: `FS_B05_r1.zip` + sidecar, runner `Run-FinScope-BatchValidation_B05_r1_v1.ps1` + sidecar y bundle versionado. No reemplaza Fuentes del Proyecto.


## v0.21.6_B05_completed — Cierre aprobado de B05 y memoria de confiabilidad

- Baseline de entrada: `FS_v0.21.5_B04_completed.zip` (`c7491391acda2aee2daee3d43f3b177285df32342d0146645bf499de1c3a3e06`).
- Candidato exacto: `FS_B05_r1.zip` (`1532d0ac3d830c4e74bf3aeef6c7f8f342a3a2460706d04d2a13250d996ea3ad`).
- Runner autenticado: `Run-FinScope-BatchValidation_B05_r1_v6.ps1` (`587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079`).
- Evidencia PASS: `FinScope_local_evidence_B05_20260725-232642920.zip` (`c7da945f9d9e705bec933156c9838d910ec5c46ca9fdbada20f30b5e8263fe4b`).
- Nueve comandos PASS; integración 2/8, E2E 4, accesibilidad 2, Vitest 22/90, browser 6 y build 123 módulos/3 assets.
- T021–T023 cerradas `[X]`; B05 `COMPLETED`; B06 `PENDING` activo/autorizado; convergencia cerrada.
- Creado `EXTERNAL_VALIDATION_RELIABILITY.md` como `NON_NORMATIVE_OPERATIONAL_CONTEXT`.
- Incidente `B05-VALIDATION-001` registrado `RESOLVED`; v3 queda referido/no verificado y v6 autenticado.
- Salvedad: no se encontró artefacto AST explícito en v6; se registra `VAL-REL-001` para futura revisión autorizada.
- Excepción de cierre: no se modificaron código, tests, runners, scripts, schemas, dependencias, fixtures, contratos ni `.specify`; no se repitió npm.


## v0.21.7_B06_local_validation_candidate_r1 — Implementación B06 pendiente de validación externa

- Baseline exclusivo verificado: `FS_v0.21.6_B05_completed.zip`, SHA-256 `603cc07bb65f69483c85266aa91ee9b2cf681fe809c98456eea482a71cb78db5`; alias de transporte ignorado.
- Preflight físico/normativo PASS: sidecar/hash, CRC, raíz única, extracción segura, Windows paths, 19 archivos `.specify`, `tasks.md`, B06 mirror/lock y plano de control inicial 994/994.
- Alcance exclusivo implementado en orden: T024 → T025 → T026 → T027 → T028 → T030. T029 y B07 no fueron implementados.
- Funcionalidad: CIK/alias local, vista inicial accesible, allowlist y guardas antes de red, tres rutas SEC explícitas, transporte acotado/redactado y cliente navegador con conditional headers, streaming limitado y validación previa al dominio.
- Validación auxiliar: compilación TypeScript aislada de fuentes y tests PASS. Los comandos npm no cerraron por HTTP 503 del registro interno y dependencias incompletas; PowerShell Core no está disponible en el entorno autor.
- Estado: T024/T025/T026/T027/T028/T030 `IMPLEMENTED_PENDING_VALIDATION`; B06 `LOCAL_VALIDATION_REQUIRED`; `activeBatchId=B06`; B07 `PENDING`; `convergenceAuthorized=false`; casillas abiertas.
- Runner nuevo autenticable: `Run-FinScope-BatchValidation_B06_r1_v1.ps1` (`9580eca84688c3707bed8a9fbfc93a737a8acc31041f2996dcb8295ee992ca5a`) y preflight independiente `Test-FinScope-B06-Preflight_r1_v1.ps1` (`2a408d35b4f7059ba3947eaad9bfaa2d423dc203f4d938a43938d5b27a6bc6f0`); deriva 11 comandos y `browserRequired=true` desde B06.
- Candidato previsto: `FS_B06_r1.zip` más sidecar; no reemplaza el B05 completed.

## v0.21.7_B06_local_validation_candidate_r2 — Remediación funcional y runner único B06

- Entrada autenticada: `FS_B06_r1.zip` (`b151f5a3df746bfb7c6f447b34bf4bff36d9499d24d4ef2eac60d474356ba723`) y evidencia FAIL `FinScope_local_evidence_B06_20260726-103544.zip` (`2571813d6bfdf3adf50682985f1b04ac9d2d49a6dfb13f2c7ba939fc4f4da49b`).
- Causa funcional: Company Concept reutilizaba el filename CIK con `.json` en un segmento de ruta.
- Causa del runner: parsing de descubrimiento sobre ANSI ocultó el fallo contractual primario.
- Corrección: helper CIK de segmento, URL exacto probado y runner único `Run-FinScope-BatchValidation_B06_r2_v1.ps1` (`2fa388fb0d6744a9d1f86d21e6a0c970294550ef9d6413fd9d6fdeb1812546d8`).
- Flujo: cuatro entradas, un comando, preflight integrado; PASS/FAIL conservan logs, `primaryFailure`, inventario y manifiesto.
- Estado preservado: T024–T030 pendientes de validación, B06 `LOCAL_VALIDATION_REQUIRED`, B07 `PENDING`, convergencia cerrada.
- Entrega prevista: `FS_B06_r2.zip` + sidecar, runner + sidecar y bundle; no reemplaza B05 completed.



## 2026-07-26 — B06 r3 remediation

- Autenticada evidencia r2 `FinScope_local_evidence_B06_20260726-122752787_FAILED.zip` SHA-256 `c73c994cee64dc9fc97838e1951d9b89ee02cf3bfd2f95c9c2480cb5e6052586`.
- Confirmado preflight/control plane PASS, siete comandos PASS, `test-e2e` FAIL y tres `NOT_RUN`.
- Corregido render dinámico de rutas Svelte legacy en `src/app/App.svelte`.
- Añadido contrato preventivo y comando E2E objetivo preciso en `batches/B06.json`; recalculado su lock.
- Sustituido runner r2 por `Run-FinScope-BatchValidation_B06_r3_v1.ps1` con Ajv temporal, UTF-8, artefactos browser y errores secundarios.
- Emitido candidato `FS_B06_r3.zip`; B05 permanece baseline, B06 permanece `LOCAL_VALIDATION_REQUIRED`, B07 `PENDING`.


## 2026-07-26 — B06 r4 schema-conformance remediation

- Autenticada evidencia r3 `FinScope_local_evidence_B06_20260726-134751447_FAILED.zip` SHA-256 `f1915acdf77afa759297d33fafe8ed657ecef774f6f314228ad3b712184c04cd`.
- Confirmados ocho comandos PASS, `regression-vitest` FAIL y dos `NOT_RUN`.
- Eliminados cinco campos no autorizados de `IMPLEMENTATION_STATE.validationWorkflow`; no se amplió el esquema.
- Añadida conformidad estructural sin dependencias al control-plane para cuatro documentos y 25 lotes.
- Añadidas autopruebas del validador y contrato preventivo de autoridad.
- Emitido candidato `FS_B06_r4.zip`; B05 permanece baseline, B06 `LOCAL_VALIDATION_REQUIRED`, B07 `PENDING`.


## 2026-07-26 — B06 r4 evidence verification and promotion

- Independently authenticated `FS_B06_r4.zip` (`ba0914bae946aae20f736c40851b2562d491dd3814c585619557f0f9354b2ce3`), `Run-FinScope-BatchValidation_B06_r4_v1.ps1` (`17f2ed3c33df3911800f1a23ef6d29d643ae292639d426d949c3f9a24007f6b9`) and `FinScope_local_evidence_B06_20260726-145803592.zip` (`0e534024b3ed13060d0c121c15256752b8cd6049fa4a3e7411a25c391a23a46d`).
- Verified 11/11 mandatory commands PASS, effective test discovery, schema-valid evidence, initial/final control plane PASS, browser artifacts, exact target-file stability and cleanup restoration.
- Closed T024, T025, T026, T027, T028 and T030; promoted B06 to `COMPLETED`; left T029 and B07 `PENDING`; kept `convergenceAuthorized=false`.
- Applied only closure allowlist mutations; no functional code, tests, runners, npm scripts, schemas, dependencies, fixtures, contracts or `.specify` changed after executable evidence.

## v0.21.8_B07_local_validation_candidate_r1 — Implementación B07 pendiente de validación externa

- Baseline de entrada verificado: `FS_v0.21.7_B06_completed.zip`, SHA-256 `45526daf30092888bdba5333526e6806d22c12d986ef51ab1c31a4f68b9a321d`.
- Alcance exclusivo implementado: T029 y T031–T035; B08 y convergencia no iniciados.
- Código/pruebas: versiones de catálogo con fallback, selección exacta de filings, plan de 14 llamadas, operación cancelable/partial, UI de consentimiento y fixtures SEC bloqueantes.
- Estado: las seis tareas `IMPLEMENTED_PENDING_VALIDATION`; B07 `LOCAL_VALIDATION_REQUIRED`; B08 `PENDING`.
- Runtime: `npm ci` bloqueado por HTTP 503 del registro de autoría y cache vacío; diez comandos `NOT_RUN` por fail-fast. No se afirma PASS ejecutable.
- Runner: `Run-FinScope-BatchValidation_B07_r1_v1.ps1`, SHA-256 `24b83d3560bb33f242838dbcddebcfb84a35227456ea3cf07054e3a8612ff8a4`, con `-SelfTestOnly` y `-PreflightOnly`; PowerShell 7 no estuvo disponible en autoría, por lo que la autocalificación ejecutable debe aprobarse en Windows antes de npm.
- `.specify` intacto: 19 archivos, `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`. `tasks.md` intacto: `94d6983807f00ea7e1aacf960790c5df9ec93313dd2b5f5549acb2cb0f301978`.

## v0.21.8_B07_local_validation_candidate_r2 — Remediación del oracle Frames tras evidencia r1 FAIL

- Evidencia autenticada: `FinScope_local_evidence_B07_20260726-201038455_FAILED.zip` (`50860118aa006cda58c38fd033781e85a99dbafbe8a573d4979ed0169af33b8e`), vinculada a `FS_B07_r1.zip` (`2a7b921bb8bd797e156b2d57a331d4a17dfb4ef370ad5c036d2fa57e0178adbe`) y `Run-FinScope-BatchValidation_B07_r1_v2.ps1` (`5fb3410bafc6bac1293e3aa2f76000b582c23d72144dc7b03357a707d1f34683`).
- r1 PASS: `npm ci`, instalación Chromium y typecheck. Unidad focalizada FAIL: 2 archivos/6 tests, 5 PASS y 1 FAIL; siete comandos posteriores `NOT_RUN` por fail-fast.
- Causa raíz: la prueba esperaba `not_found` para `frame=CY2025`, pero la política activa y el fixture congelado exigen `evidence_only`; el selector productivo ya era correcto.
- Corrección r2: modificar solo `tests/unit/fundamental/filing-selection.test.ts`; no cambiar runtime, fixture, contrato, `.specify`, `spec.md`, `tasks.md`, FR/NFR/AC ni B08.
- Nuevo candidato `FS_B07_r2.zip` y runner `Run-FinScope-BatchValidation_B07_r2_v1.ps1`; B07 continúa `LOCAL_VALIDATION_REQUIRED`, seis tareas `IMPLEMENTED_PENDING_VALIDATION`, B08 `PENDING`, convergencia cerrada.

## v0.21.8_B07_completed — Cierre aprobado del lote B07

- Baseline de entrada: `FS_v0.21.7_B06_completed.zip` (`45526daf30092888bdba5333526e6806d22c12d986ef51ab1c31a4f68b9a321d`).
- Candidato exacto: `FS_B07_r2.zip` (`82ef0df6d4b935da6276926138ec00d8dd6f3a465a91d18701c2e375acf1c0f8`).
- Runner autenticado: `Run-FinScope-BatchValidation_B07_r2_v1.ps1` (`c58960a5393a9f252c9fa9430542325b2402b5aaa4bf18bb467d453db8ffacaa`).
- Evidencia PASS: `FinScope_local_evidence_B07_20260726-203511327.zip` (`8f34fca7807b71f56d1879bada5fed1713a9f3eb3f3d042820a03351ce100059`).
- Once comandos PASS; unidad 2/6, integración 2/6, contratos 1/4, negativas 1/4, E2E 10, Vitest 33/135, browser 12 y build 250 módulos/3 assets.
- T029 y T031–T035: `COMPLETED` y `[X]`; B07 `COMPLETED`.
- B08: `PENDING`, único lote activo/autorizado; B09 no iniciado; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- Entregable físico: `FS_v0.21.8_B07_completed.zip` y sidecar `FS_v0.21.8_B07_completed.zip.sha256`.


## v0.21.9_B08_local_validation_candidate_r1 — Implementación B08 pendiente de validación externa

- Baseline exclusivo autenticado: `FS_v0.21.8_B07_completed.zip` (`6e87f79be53a913fbf3db602cc50b1fa1fa211663596b126037c4a9b4d55be2e`); sidecar, CRC, raíz única, extracción segura, manifiesto, inventario, metadata, plano de control y `.specify` PASS.
- Implementadas exclusivamente T036–T040: mappings XBRL, perfiles, saneamiento, períodos/TTM y deuda; B09 no iniciado.
- Añadidas cinco suites unitarias focalizadas. Compilación TypeScript estricta aislada PASS y arnés auxiliar 29/29; no sustituyen npm.
- `npm ci` no produjo salida y fue terminado por el entorno; cuatro comandos posteriores `NOT_RUN` por fail-fast.
- Runner `Run-FinScope-BatchValidation_B08_r1_v1.ps1` (`4105d3bb43c214ea82e163136fd9a45dcc90ec0f7ca04c5fd269af4d20a4c468`) deriva cinco comandos y `browserRequired=false`; PowerShell 7 no está disponible en autoría, por lo que `-SelfTestOnly` debe pasar externamente antes de npm.
- Estado: B08 `LOCAL_VALIDATION_REQUIRED`; T036–T040 `IMPLEMENTED_PENDING_VALIDATION`; B09 `PENDING`; convergencia cerrada.
- `B08.json` recalculado a `4f46b410572fd6253859e2d7931bd08afdae4c1600a261ded128926f8891c08a`; `tasks.md` y 19 archivos `.specify` permanecen inmutables.

## v0.21.9_B08_local_validation_candidate_r2 — Corrección de oracle T038 tras evidencia r1 FAIL

- Evidencia autenticada: `FinScope_local_evidence_B08_20260726-235329530_FAILED.zip` (`5c89875412ec3ccf7649290c99c3a061591e7009b7c86a9f496c7badb4e0739b`).
- `npm ci` y `typecheck` PASS; suite focalizada 5 archivos/20 tests, 19 PASS y 1 FAIL; regresión/build `NOT_RUN` por fail-fast.
- Causa: el test esperaba orden por `factId`, pero AUTH-014 exige `canonicalConceptId`, `periodId`, `scopeId`, `factId`.
- Remediación: solo cambia `tests/unit/fundamental/fact-sanitizer.test.ts`; runtime, autoridades, fixtures, `.specify`, `spec.md`, `tasks.md` y `B08.json` permanecen intactos.
- Riesgo funcional: ninguno. Candidato `FS_B08_r2.zip` y runner `Run-FinScope-BatchValidation_B08_r2_v1.ps1` (`18cf5837ebe62f945a5549def65923ef9896326cab5e096079d113c72c325867`) requieren validación completa fresca.
- Estado: B08 `LOCAL_VALIDATION_REQUIRED`; T036–T040 `IMPLEMENTED_PENDING_VALIDATION`; B09 `PENDING`; convergencia cerrada.

## v0.21.9_B08_completed — Cierre aprobado del lote B08

- Baseline de entrada: `FS_v0.21.8_B07_completed.zip` (`6e87f79be53a913fbf3db602cc50b1fa1fa211663596b126037c4a9b4d55be2e`).
- Candidato exacto: `FS_B08_r2.zip` (`05584b07899a33c9585d3b8c4e33f41986d52be792e65a773f952cf8fc920039`).
- Runner autenticado: `Run-FinScope-BatchValidation_B08_r2_v1.ps1` (`18cf5837ebe62f945a5549def65923ef9896326cab5e096079d113c72c325867`).
- Evidencia PASS: `FinScope_local_evidence_B08_20260727-204245257.zip` (`5c7fa166241ba1063d6d8722a4d2b0ed7d50e4098129bf07d80b032b91ed4c66`).
- Cinco comandos PASS; unidad 5/23, regresión 38/158 y build 250 módulos/3 assets.
- T036–T040: `COMPLETED` y `[X]`; B08: `COMPLETED`.
- B09: `PENDING`, único lote activo/autorizado; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- Entregable físico: `FS_v0.21.9_B08_completed.zip` y sidecar `FS_v0.21.9_B08_completed.zip.sha256`.

## 2026-07-27 — B09 r1 implementation candidate

- verified `FS_v0.21.9_B08_completed.zip` at `2e223126bf9402dce9e6ad9c247eaa999c316684ed37c13a08ff891259048f4e` and passed structural/control-plane preflight;
- implemented T041, T043 and T042 only;
- added the closed formula engine, categorical quality classifiers, 24 fundamental metrics and mandatory vector tests;
- `npm ci` was blocked by HTTP 503 in the authoring package gateway, so B09 remains `LOCAL_VALIDATION_REQUIRED`;
- added authenticated runner `Run-FinScope-BatchValidation_B09_r1_v1.ps1` and external validation instructions;
- preserved B10 `PENDING`, convergence closed and `.specify` byte-identical.

## 2026-07-27 — B09 r2 remediation after authenticated r1 FAIL

- authenticated `FinScope_local_evidence_B09_20260727-221234687_FAILED.zip` (`cbbb02e698a469f224c0001ee05c29ff4625e509b6c20dfb024b8ff5a5467167`), candidate r1 (`2f384dbcb3399ff9bca19ae4d44325c71219310854985607ad652c666de4faeb`) and runner r1 (`5fd8b7653ecec92200fca2a2fdb698b024363d04f09606a1b35b8a87bbc882b7`);
- confirmed `npm ci` and typecheck PASS; focused suite discovered 3 files/117 tests, with 116 PASS and one FAIL; regression/build were not run by fail-fast;
- isolated the failure to incomplete test-only Ajv registration: `formula-vectors.schema.json` referenced `common.schema.json#/$defs/DecimalString`, but the standalone test registry omitted the common schema;
- corrected only `tests/unit/analytics/formula-vectors.test.ts` to reuse the completed T012 `ProductSchemaValidator`; runtime, formulas, metrics, schemas, fixtures, contracts and authorities remain unchanged;
- issued candidate `FS_B09_r2.zip` and identity-updated runner `Run-FinScope-BatchValidation_B09_r2_v1.ps1` (`25d6ad3be32313960dbce654d1ec4ae3cd950f288a6c4733737c395843dc5f04`);
- retained B09 `LOCAL_VALIDATION_REQUIRED`, T041/T043/T042 `IMPLEMENTED_PENDING_VALIDATION`, B10 `PENDING` and convergence closed.


## v0.21.10_B09_completed — Cierre aprobado del lote B09

- Baseline de entrada: `FS_v0.21.9_B08_completed.zip` (`2e223126bf9402dce9e6ad9c247eaa999c316684ed37c13a08ff891259048f4e`).
- Candidato exacto: `FS_B09_r2.zip` (`b97d7e1dbdfe2345aaa38334cddc778070a5700dd7afd0fceb89dbf2259149ca`).
- Runner autenticado: `Run-FinScope-BatchValidation_B09_r2_v1.ps1` (`25d6ad3be32313960dbce654d1ec4ae3cd950f288a6c4733737c395843dc5f04`).
- Evidencia PASS: `FinScope_local_evidence_B09_20260727-223609830.zip` (`9b58ee1b03832de4c0fce93fb3fb82398623bfa0d8576a01d5ef8900d4357b05`).
- Cinco comandos PASS; unidad 3/120, regresión 41/278 y build 250 módulos/3 assets.
- T041, T043 y T042: `COMPLETED` y `[X]`; B09: `COMPLETED`.
- B10: `PENDING`, único lote activo/autorizado; B11 no iniciado; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- Entregable físico: `FS_v0.21.10_B09_completed.zip` y sidecar `FS_v0.21.10_B09_completed.zip.sha256`.

## 2026-07-27 — B10 r1 implementation candidate

- authenticated baseline `FS_v0.21.10_B09_completed.zip` at `1d24563346366a4a4e6bd3780520a0e46784e42d3ca1cf708ac555a4dec65161` and passed structural/control-plane preflight;
- implemented only T044–T046: closed nine-rule AST evaluator, deterministic five-state synthesis and separate JCS/SHA-256 projections;
- strict isolated TypeScript diagnostics passed for the seven target files;
- `npm ci` failed with HTTP 503 for `zimmerframe-1.1.4.tgz`; four dependent commands remain `NOT_RUN` and no normative PASS is claimed;
- issued candidate `FS_B10_r1.zip` and runner `Run-FinScope-BatchValidation_B10_r1_v1.ps1` (`6e2ef7ecb6f7989e4c05516ce95b86da18dceb4d7e3cd32c388784e89a906d34`);
- retained T044–T046 `IMPLEMENTED_PENDING_VALIDATION`, B10 `LOCAL_VALIDATION_REQUIRED`, B11 `PENDING`, convergence closed and `.specify` byte-identical.

## 2026-07-28 — B10 r2 remediation after authenticated r1 regression FAIL

- authenticated `FinScope_local_evidence_B10_20260728-003221644_FAILED.zip` (`4bff6dfadd1f8eec8c4bfa4a4bb0930107f529a37465cb98fc18df8635c7e444`), bound to `FS_B10_r1.zip` (`50a0cfda8966ce85420ea880e4af6d299c6e3837c33934ed021fefbce0df192e`) and `Run-FinScope-BatchValidation_B10_r1_v2.ps1` (`8a3f4e3c8b33389f83cd7fb69173abf92f5a9909cd1a14ecf2ecb167ac694936`);
- confirmed PASS for `npm ci`, typecheck and the focused B10 suite (3 files/47 tests); full Vitest regression failed only at exact authority loading because `V0.21_PHASE_STATUS.md#gate` had no explicit anchor; build was `NOT_RUN` by fail-fast;
- root cause: the B10 r1 gate-document rewrite omitted `<a id="gate"></a>` that existed in the completed B09 baseline; the loader and crosswalk were correct;
- r2 restores the exact anchor and keeps B10 runtime, B10 tests, schemas, fixtures, contracts, tasks, B10 mirror and `.specify` unchanged;
- issued `FS_B10_r2.zip` and `Run-FinScope-BatchValidation_B10_r2_v1.ps1` (`8960f8d4dc9e05651e9c64130e62036c9e8e9500e229b8a4d2e909fb82f60489`); B10 remains `LOCAL_VALIDATION_REQUIRED`, T044–T046 remain `IMPLEMENTED_PENDING_VALIDATION`, B11 `PENDING`, convergence closed.


## v0.21.11_B10_completed — Cierre aprobado del lote B10

- Baseline de entrada: `FS_v0.21.10_B09_completed.zip` (`1d24563346366a4a4e6bd3780520a0e46784e42d3ca1cf708ac555a4dec65161`).
- Candidato exacto: `FS_B10_r2.zip` (`ae5733d8e80abd67bd2ab307b130c69413d458f6342bba11c8b07bb18d5d4d43`).
- Runner autenticado: `Run-FinScope-BatchValidation_B10_r2_v1.ps1` (`8960f8d4dc9e05651e9c64130e62036c9e8e9500e229b8a4d2e909fb82f60489`).
- Evidencia PASS: `FinScope_local_evidence_B10_20260728-005728426.zip` (`c475f0446741bd4a4e3a2bf217f31221d95a81fb8f29b44f1a2f3d71a2aa461b`).
- Cinco comandos PASS; unidad 3/47, regresión 44/325 y build 250 módulos/3 assets.
- T044–T046: `COMPLETED` y `[X]`; B10: `COMPLETED`.
- B11: `PENDING`, único lote activo/autorizado; B12 no iniciado; convergencia cerrada.
- Cierre limitado por allowlist; cero cambios post-evidencia en runtime, tests, runners, scripts, schemas, dependencias, fixtures, contratos, FR/NFR/AC, decisiones o `.specify`.
- Entregable físico: `FS_v0.21.11_B10_completed.zip` y sidecar `FS_v0.21.11_B10_completed.zip.sha256`.


## 2026-07-28 — B11 r1 implementation candidate

- baseline completed autenticado: `FS_v0.21.11_B10_completed.zip` (`8a73e0ebbb8bb4e56f3aeb1df7982ae8bbd9e4789060d830250985820d86c06e`); CRC, raíz, extracción segura, manifiesto, inventario, metadata, plano de control y `.specify` PASS;
- implementadas exclusivamente T047 y T048: builders fundamentales inmutables y pipeline Web Worker con publicación atómica o preservación del estado previo;
- agregadas las suites focalizadas unitarias e integración exigidas por B11; sintaxis y typecheck focalizado auxiliar PASS;
- `npm ci` falló con HTTP E503 para `zimmerframe-1.1.4.tgz`; cinco comandos dependientes `NOT_RUN`; no se afirma PASS;
- emitido candidato `FS_B11_r1.zip` y runner `Run-FinScope-BatchValidation_B11_r1_v1.ps1` (`ebbee32a878e9c0e1c3015231f108c3a41ae6ce6d4e9af67e381ffcd399144ac`);
- estado: T047/T048 `IMPLEMENTED_PENDING_VALIDATION`, B11 `LOCAL_VALIDATION_REQUIRED`, B12 `PENDING`, convergencia cerrada y `.specify` byte-inmutable.

## 2026-07-28 — B11 r2 remediation after authenticated r1 unit FAIL

- authenticated `FinScope_local_evidence_B11_20260728-120326874_FAILED.zip` (`4798e0984269a56c5f7b4ec25962d15ec6f3bee8f004cef8cd48aa9b3ea81b2`), candidate r1 (`b088457da0d8538ce89346efc21c21a7afc2b1eb1cb25c7f34d2fc94cf7e90ca`) and runner r1 v1 (`ebbee32a878e9c0e1c3015231f108c3a41ae6ce6d4e9af67e381ffcd399144ac`);
- confirmed runner SelfTest/preflight, `npm ci` and typecheck PASS; T047 suite discovered 1 file/4 tests, 3 PASS and 1 FAIL; integration, regression and build were `NOT_RUN` by fail-fast;
- root cause: the test expected the literal error-message token `DecimalString`, while the completed canonical decimal service correctly returned `DecimalStringError` code `NON_CANONICAL_DECIMAL` and message `Decimal string is not canonical`;
- corrected only `tests/unit/fundamental/bundle-vectors.test.ts` to assert typed error name/code; production builders, pipeline, schemas, fixtures, contracts, authorities, B11 mirror, tasks and `.specify` remain unchanged;
- issued candidate `FS_B11_r2.zip` and identity-updated runner `Run-FinScope-BatchValidation_B11_r2_v1.ps1`; B11 remains `LOCAL_VALIDATION_REQUIRED`, T047/T048 remain `IMPLEMENTED_PENDING_VALIDATION`, B12 `PENDING` and convergence closed.

## 2026-07-28 — B11 r3 remediation after authenticated r2 integration FAIL

- authenticated `FinScope_local_evidence_B11_20260728-124812252_FAILED.zip` (`34bb65f09a1909c95ed07cfed5d33d242f067d2d5ea4ce0bf3cdf115227e450a`), candidate r2 (`3289a833accc609219158a19c0f79d3454b050d321bb29c8278dddd8fdbb8b40`) and runner r2 v1 (`1cfd764eeb2c1ccc4f80994223ea63f091da51510a4fb003187a24e97d5f5e22`);
- confirmed SelfTest/preflight, `npm ci`, typecheck and focused T047 unit suite PASS; focused T048 integration failed first test and regression/build were `NOT_RUN` by fail-fast;
- root cause: integration helper generated `bundleId` with colon although active schema requires `^fund-bundle-[a-z0-9-]+$`; builder/pipeline/registry correctly rejected and preserved state;
- corrected only `tests/integration/worker/fundamental-pipeline.test.ts` to use a hyphen; production runtime, unit test, schemas, fixtures, catalogs, dependencies, B11 mirror, tasks and `.specify` remain unchanged;
- issued candidate `FS_B11_r3.zip` and identity-only runner `Run-FinScope-BatchValidation_B11_r3_v1.ps1`; B11 remains `LOCAL_VALIDATION_REQUIRED`, T047/T048 remain `IMPLEMENTED_PENDING_VALIDATION`, B12 `PENDING`, convergence closed.


## v0.21.12_B11_completed — Cierre aprobado del lote B11

- Baseline de entrada exclusivo: `FS_v0.21.11_B10_completed.zip`; SHA-256 `8a73e0ebbb8bb4e56f3aeb1df7982ae8bbd9e4789060d830250985820d86c06e`.
- Candidato exacto: `FS_B11_r3.zip`; SHA-256 `aa81ec122127863b45e2949335e42c607a6df7ad6697d0181a2cab1f6a37b8f2`.
- Runner autenticado: `Run-FinScope-BatchValidation_B11_r3_v1.ps1`; SHA-256 `b5b89a8e734c67e0a92dd77ad90226454a1eecbede9236553ba8e3ed956090c6`.
- Evidencia externa PASS: `FinScope_local_evidence_B11_20260728-131922732.zip`; SHA-256 `8bcd8e22068631450920fe2a34314546055363aca8ec0d460d76dd3a2f180dc3`.
- Seis comandos obligatorios PASS: unidad 1 archivo/4 tests, integración 1 archivo/4 tests, regresión 46 archivos/333 tests y build 250 módulos/3 assets.
- T047 y T048 pasan a `COMPLETED`; B11 pasa a `COMPLETED`; B12 queda `PENDING` como único lote activo/autorizado.
- Cierre aplicado exclusivamente mediante la allowlist: checkboxes, estados, mirrors/hashes derivados, ledger, reportes, contexto, metadata, inventario y manifiesto.
- No se repitieron npm ni pruebas después de la evidencia porque no cambiaron código, tests, runners, scripts, schemas, dependencias, fixtures, contratos ni comportamiento.
- `.specify`: 19/19 archivos byte-idénticos; hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
- Estado de continuidad: `activeBatchId=B12`, `nextAuthorizedBatchId=B12`, B13 `PENDING`, `convergenceAuthorized=false`.

## 2026-07-29 — GH0 GitHub-first candidate

- Added pinned GitHub Actions workflows, operational protocols, evidence schemas, cross-platform Node scripts and stable handoff.
- Preserved B12/T049–T053 PENDING and `.specify` byte-identical.
- First PR run intentionally injects a hash mismatch through handoff configuration; workflows/scripts remain unchanged for recovery.

## 2026-07-30 — GH0 final candidate r2 recovery

- Preserved exact repository bytes across platforms with `.gitattributes`.
- Corrected PR validation and closure checkout to the exact branch head SHA.
- Bound validation and closure evidence to the checked-out Git HEAD.
- Derived GH0 validation commands literally from the active batch instead of the handoff mirror.
- Updated the operational schema contract from eight to ten schemas.
- Restricted closure execution to `GITHUB_HANDOFF.json` changes and retained fail-closed `NOT_APPLICABLE` semantics before closure authorization.
- Reconciled `GH0_PREFLIGHT_RELEASE_VERIFICATION.json`, its Markdown mirror and `GH0_SCOPE_GUARD.md` into inventory and manifest.
- Preserved B12/T049–T053 as `PENDING` and `convergenceAuthorized=false`.

## 2026-07-30 — GH0 candidate r3 GitHub workspace remediation

- Preserved the authenticated local PASS and remote FAILURE evidence for candidate r2.
- Changed only the control-plane contract root resolution and candidate-stage closure enforcement.
- Required the contract to use `FINSCOPE_PACKAGE_ROOT` in GitHub Actions and `.` only as a local fallback.
- Allowed `NOT_APPLICABLE` to complete the candidate-stage closure workflow without representing a real closure PASS.
- Preserved B12/T049–T053 as `PENDING`, `convergenceAuthorized=false`, all product authorities and all 19 `.specify` files.

## 2026-07-30 — GH0 candidate r4 control-plane output flush remediation

- Preserved candidate r3 local command PASS evidence, its verified remote commit and the GitHub artifacts.
- Replaced asynchronous console output plus immediate process termination in `Validate-ControlPlaneState.mjs`.
- Wrote the complete JSON and status marker synchronously before setting `process.exitCode`.
- Added runner qualification for large piped JSON and PR-head eventual consistency.
- Preserved B12/T049–T053 as `PENDING`, `convergenceAuthorized=false`, all product authorities and all 19 `.specify` files.

## 2026-07-30 — GH0 candidate r4 authenticated and closure requested

- Authenticated local PASS evidence `FinScope_GH0_candidate_r4_20260730185824782_PASS.zip` with SHA-256 `7699db51452e06f992c4f887cce1e798555dc0cc88fff8e1e54c731fe8e66cee`.
- Authenticated GitHub PR Validation run `30572841974` and artifact `8771517121` with digest `sha256:89885a0aed5ec8f7776abad82761d346ce02d9cf1fd3d8e86011e0afb7b5fdb6`.
- Registered the exact candidate SHA `98fb21313fe85f740d0398fc473b3e74b306a936` in `GITHUB_HANDOFF.json`.
- Changed `bootstrap.stage` from `candidate` to `closure`, set closure status `PENDING` and set `release.pending=true` for the authorized post-closure merge.
- Preserved B12/T049–T053 as `PENDING`, `convergenceAuthorized=false`, all product authorities and all 19 `.specify` files.
- Did not rerun npm locally because the closure diff is limited to the post-evidence allowlist; GitHub workflows remain the independent remote gate.


## 2026-07-31 — B12 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.13_GH0_completed.zip` (`788c563eee82762c6171f03296e33222d7b50ed13f03fa798a409473343be469`);
- candidate exacto: `06df86a6f68868474f28a090b75a968291b1fe2a`, run `30633065198`, artifact `8794161946`;
- todos los comandos obligatorios del mirror B12 PASS;
- T049, T050, T051, T052, T053 y B12 pasan a `COMPLETED`; B13 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-03 — Soporte fail-closed para cierre de remediaciones

- se separan explícitamente `BATCH_CLOSURE`, `REMEDIATION_CLOSURE` y `NOT_APPLICABLE`;
- la remediación `b21-clean-completed-package-remediation` recibe `closurePolicy` propia en `candidate/NOT_REQUESTED`, sin candidato ni cierre cargados;
- el aplicador de remediación autentica únicamente candidato, run y artifact propios y limita toda mutación a cuatro rutas declaradas;
- schema Draft 2020-12, validación dependency-free/Ajv, contratos negativos y routing del workflow preservan B21 `COMPLETED`, B22 `PENDING`, producto y `.specify` sin cambios;
- no se solicita ni aplica el cierre en este candidato.

## 2026-08-03 — Evidencia candidata 24a42b6 rechazada

- run `30831435223`, artifact `_FAILED` `8863072687`, digest `sha256:9478c743b366cf0ce93640e31ce72d1c16108cd5e5f40f10b5df5707ff82002d`;
- `primaryFailure=COMMAND_FAILED` en `batch-closure-regression`: Vitest devolvió exit 0, pero el filtro declaró 31 tests `skipped` y el discovery fail-closed lo rechazó;
- todos los comandos dependientes quedaron `NOT_RUN`;
- se eliminan los filtros de los comandos literales de regresión batch y schema para ejecutar el contrato completo sin tests omitidos; se requiere commit y workflow nuevos.

## 2026-08-03 — Remediación técnica del paquete B21 contaminado

- operación tipada `MAINTENANCE_REMEDIATION` en `agent/b21-clean-completed-package-remediation`;
- baseline B20 permanece activo; el Release B21 publicado queda rechazado como Fuentes por `github-context.json`;
- staging cambiado a blobs del commit Git exacto, con denylist independiente y verificación de procedencia byte a byte;
- contexto del resolver movido a `$RUNNER_TEMP` con cleanup `always`;
- publicación reforzada con reautenticación completa de cinco assets y preservación fail-closed del Release publicado;
- sin cambios de producto, B22, tareas, lotes, gates o `.specify`; `convergenceAuthorized=false`.

## 2026-08-03 — Gate pre-merge de autoridad de publicación B21

- `v0.21.26-B21-completed` permanece rechazado como baseline y preservado como evidencia histórica;
- `release.pending=false` impide reutilizar accidentalmente su identidad publicada;
- el cierre `a3230e9f61c0ef69f87ec1600432067e4bf1a9c5` fue válido y queda supersedido exclusivamente por esta corrección pre-merge;
- cualquier publicación futura requiere identidad inmutable nueva: tag, revisión, ZIP y sidecar nuevos;
- B21 permanece `COMPLETED`, B22 permanece `PENDING`, y producto, tareas, batches y `.specify` no cambian; `convergenceAuthorized=false`.


## 2026-07-31 — B13 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.14_B12_completed.zip` (`d5a278507e880c49e10adae9f087eb6b9bb6c05b57d61253b8662afa300c8d9a`);
- candidate exacto: `68d47100ff3a2d520a5ad2769a61bfe7090fa611`, run `30654130117`, artifact `8802543812`;
- todos los comandos obligatorios del mirror B13 PASS;
- T054, T055, T056, T057, T058, T059 y B13 pasan a `COMPLETED`; B14 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-07-31 — B14 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.16_B13_completed.zip` (`815e2dcdc5c2f149b3b7cc6dc7083ea3ef79642b82599534d8ee3816b94c0796`);
- candidate exacto: `4adacd4dd45f60ba143937e68f555315c37bf206`, run `30674163121`, artifact `8809856237`;
- todos los comandos obligatorios del mirror B14 PASS;
- T060, T061, T062 y B14 pasan a `COMPLETED`; B15 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-01 — B15 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.17_B14_completed.zip` (`853cdfd12bb605905703e74969992092605666a0644b420995a3000ca3c5708c`);
- candidate exacto: `eeb4d7065be5d0883ef72aaa89de5d07758b1f18`, run `30677021963`, artifact `8810837405`;
- todos los comandos obligatorios del mirror B15 PASS;
- T063, T064, T065, T066, T067, T068 y B15 pasan a `COMPLETED`; B16 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-01 — B16 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.18_B15_completed.zip` (`59482da2464228c1813c7b3b7aacd5240fbbca63837c18476204a665f21dc400`);
- candidate exacto: `21a4fa2e96e161a5b0ff1633a7200343bbf810d5`, run `30681576838`, artifact `8812444556`;
- todos los comandos obligatorios del mirror B16 PASS;
- T069, T070, T071 y B16 pasan a `COMPLETED`; B17 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-01 — B17 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.19_B16_completed.zip` (`6553ce27b8c4d21ceab4967628debcba0ffc67c1b736d0d488f3c6fa36881bc0`);
- candidate exacto: `244ee6a50f8eebdeb2d1c76bab599e3c79ec4abe`, run `30713946002`, artifact `8822770890`;
- todos los comandos obligatorios del mirror B17 PASS;
- T072, T073, T074, T075, T076 y B17 pasan a `COMPLETED`; B18 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-02 — B18 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.20_B17_completed.zip` (`d212c78871b8d6f53b26bfcb43c9a272cabcf043218dedec77439db7e399049d`);
- candidate exacto: `bc80cad07e51bc7e93d196e8854c78b873ca5e6b`, run `30725871924`, artifact `8826336502`;
- todos los comandos obligatorios del mirror B18 PASS;
- T077, T078, T079, T080 y B18 pasan a `COMPLETED`; B19 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-02 — B19 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.22_B18_completed.zip` (`1588cb6c69559b41580f75f95979dbae84b480c99c917070f39ef165f6fe79bb`);
- candidate exacto: `52e2f934beef1cf31fa662ea5cb0f2ab42f13ff4`, run `30733785638`, artifact `8828860313`;
- todos los comandos obligatorios del mirror B19 PASS;
- T081, T082, T089, T083, T084, T085 y B19 pasan a `COMPLETED`; B20 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-03 — B20 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.24_B19_completed.zip` (`0f5cf8bd7708fd3f01c065451e99dc604ac8b244a3717c9a27eb7de1ce45b2b0`);
- candidate exacto: `69ed435b2f05ae2d6498846416d2e3750807ef36`, run `30776552229`, artifact `8842295323`;
- todos los comandos obligatorios del mirror B20 PASS;
- T086, T087, T088 y B20 pasan a `COMPLETED`; B21 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.


## 2026-08-03 — B21 candidate PASS y cierre GitHub-first

- baseline autenticado: `FS_v0.21.25_B20_completed.zip` (`c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`);
- candidate exacto: `ee8e1555916b2d1de8560e822a6ce4d6fe41cdff`, run `30813098460`, artifact `8855585676`;
- todos los comandos obligatorios del mirror B21 PASS;
- T090, T091, T092, T093, T094, T095 y B21 pasan a `COMPLETED`; B22 queda `PENDING`;
- cierre limitado a la allowlist y `convergenceAuthorized=false`.
## 2026-08-03 — Atomic remediation-closure support

- `Apply-GitHubRemediationClosure.mjs` prepares and commits the closure locally without pushing;
- local verification now fails closed on apply/control-plane outcomes and rechecks allowlists, candidate evidence and immutable product/control-plane scopes;
- `Finalize-GitHubRemediationClosure.mjs` performs the only remediation push with an exact request-SHA lease and confirms the remote closure SHA;
- final PASS evidence is emitted only after remote confirmation; B21 remains `COMPLETED`, B22 remains `PENDING`, and `convergenceAuthorized=false`.


## 2026-08-03 — Authenticated remediation closure

- remediation: `b21-clean-completed-package-remediation`;
- candidate: `7be25f475d3fc4ee3075ac4b56818554d3c92db4`, run `30840461597`, artifact `8866567897`;
- closure request: `62252e6ac2ca48f74790b1947321c99be1155a2e`, run `30842289780`;
- B21 remains `COMPLETED`; B22 remains `PENDING`; no tasks, batches, product, or `.specify` bytes changed.


## 2026-08-03 — Post-closure lifecycle certification correction

- authenticated closure `2c44c4a6c97dd37f638d21c16c4c15cec7fe61fe`, run `30842289780`, artifact `8867265160`, remains valid historical evidence;
- that closure is superseded exclusively by this post-closure certification correction because exact-head candidate, closure, and completed lifecycle tests must use controlled fixtures;
- no product, tasks, batches, gates, release, or `.specify` bytes changed;
- the replacement candidate must pass a new authenticated closure before it can be promoted;
- the prior human closure authorization was consumed and no new closure is requested or authorized by this correction.


## 2026-08-03 — Authenticated remediation closure

- remediation: `b21-clean-completed-package-remediation`;
- candidate: `69e3806a821986bffb7760ddd5dbe221eab4c598`, run `30845191439`, artifact `8868396936`;
- closure request: `ec292173372ed35b0adcf4534d7ffcf2848ef91d`, run `30846500890`;
- B21 remains `COMPLETED`; B22 remains `PENDING`; no tasks, batches, product, or `.specify` bytes changed.

## 2026-08-03 — B21 pre-merge Release gate r1 FAIL y corrección ZIP Windows

- candidato local preservado: `5a67550c3eead25ce4b7b79855ab13224b82bd55`;
- validación local: `13/19 PASS`; fallo primario en `clean-package-dry-run`; comandos 15–19 no ejecutados;
- error autenticado: `ZIP_CREATE_FAILED: tar: Cannot connect to C: resolve failed`;
- no hubo push, GitHub Actions, merge, tag ni Release;
- causa: el fallback resolvió GNU tar mediante PATH y le entregó una ruta absoluta `C:\\...`, interpretada como identidad remota;
- `--force-local` por sí solo no acredita que el resultado sea un ZIP real;
- corrección: Info-ZIP cuando está disponible o `%SystemRoot%\System32\tar.exe` en Windows, siempre mediante vector de argumentos y salida relativa;
- la firma ZIP se autentica antes del sidecar y del verificador completed;
- producto, tareas, batches, `IMPLEMENTATION_STATE.json` y `.specify` permanecen sin cambios.

## 2026-08-03 — B21 completed-package contract timeout remediado

- el FAIL R2 expiró en el timeout implícito de Vitest de 5000 ms mientras ejecutaba el empaquetado ZIP real;
- una reproducción con 30000 ms también expiró y mostró `EBUSY` durante cleanup porque el proceso hijo aún retenía el ZIP;
- la ejecución directa del empaquetador terminó `PASS` en 60696 ms, con firma `504b0304`, sidecar correcto y verificador completed `PASS`;
- el backend ZIP y el proceso empaquetador quedan acotados a 120000 ms; la prueba dispone de 150000 ms para que toda terminación controlada preceda al cleanup;
- no se agregan retries ni se eliminan aserciones; cualquier timeout falla cerrado con `ZIP_CREATE_FAILED:ZIP_BACKEND_TIMEOUT`;
- producto, tareas, batches, `IMPLEMENTATION_STATE.json` y `.specify` permanecen sin cambios.


## 2026-08-03 — Authenticated remediation closure

- remediation: `b21-clean-completed-package-remediation`;
- candidate: `41174f21268ae71e8301313a229e1faaab69fbe5`, run `30856160876`, artifact `8872559141`;
- closure request: `48fbe9111be2a64a88ae35d228440ce851b36788`, run `30856525648`;
- B21 remains `COMPLETED`; B22 remains `PENDING`; no tasks, batches, product, or `.specify` bytes changed.


## 2026-08-04 — Authenticated remediation closure

- remediation: `b21-final-release-promotion-remediation`;
- candidate: `490cd0e0cd8b65054a1f4e259aaa7163f635aa97`, run `30862865157`, artifact `8875011330`;
- closure request: `7e7e66110e47f35569e3c262775aa867c0752992`, run `30864997129`;
- B21 remains `COMPLETED`; B22 remains `PENDING`; no tasks, batches, product, or `.specify` bytes changed.

## 2026-08-04 — Authenticated remediation closure request

<!-- FINSCOPE_REMEDIATION_CLOSURE_REQUEST_V1 -->
```json
{"authorizationText":"Autorizo solicitar y ejecutar exclusivamente el cierre autenticado de b21-final-release-promotion-remediation para el candidato exacto 370718c42a8b1f558580c53e6e257e0cc0505b55, asociado al PR Validation run 30923907829 y al artifact 8898272190, name finscope-github-validation-370718c42a8b-PASS, digest sha256:6f82fa9bc247faab9a81a2a1d077603c1c20b74b988b9f0e9b3036f727e25de1. No autorizo Ready for Review, merge, tag, Release, reemplazo de Fuentes, B22 ni convergencia.","remediationId":"b21-final-release-promotion-remediation","candidateSha":"370718c42a8b1f558580c53e6e257e0cc0505b55","workflowRunId":30923907829,"artifactId":8898272190,"artifactName":"finscope-github-validation-370718c42a8b-PASS","artifactDigest":"sha256:6f82fa9bc247faab9a81a2a1d077603c1c20b74b988b9f0e9b3036f727e25de1","timestamp":"2026-08-04T17:18:11.288Z","postClosureProhibitions":["No marcar el PR como Ready for Review.","No fusionar el PR.","No crear, modificar ni eliminar tags.","No crear, publicar, sobrescribir ni eliminar Releases.","No reemplazar los archivos de Fuentes.","No iniciar B22 ni lotes posteriores.","No ejecutar convergencia."]}
```
<!-- /FINSCOPE_REMEDIATION_CLOSURE_REQUEST_V1 -->


## 2026-08-04 — Authenticated remediation closure

- remediation: `b21-final-release-promotion-remediation`;
- candidate: `370718c42a8b1f558580c53e6e257e0cc0505b55`, run `30923907829`, artifact `8898272190`;
- closure request: `1741c3bb2cc9793b49cc632bd1c3b570a38dca1e`, run `30933284189`;
- B21 remains `COMPLETED`; B22 remains `PENDING`; no tasks, batches, product, or `.specify` bytes changed.


<!-- B21_PUSH_NORMAL_OPERATOR_POLICY_V1 -->
## 2026-08-04 — Normal fast-forward closure finalization and operator-selection remediation

- autorización: corregir la causa primaria del bloqueo de cierre B21 y la ambigüedad de selección de operador;
- estado preservado: `b21-final-release-promotion-remediation` continúa en `candidate/NOT_REQUESTED`; no se solicita ni ejecuta cierre;
- operador: ChatGPT para custodia/auditoría y mutación GitHub únicamente cuando pueda garantizar atomicidad; VS Code para mutación local multarchivo; Codex solo por solicitud explícita del usuario;
- push: se elimina `force-with-lease` y se exige push normal fast-forward con comprobación remota previa, ancestry y confirmación remota posterior;
- impacto: este cambio modifica bytes ejecutables y exige un nuevo candidate SHA, una PR Validation completa y artifact PASS nuevos antes de cualquier solicitud de cierre;
- prohibiciones conservadas: no Ready for Review, merge, tag, Release, reemplazo de Fuentes, B22 ni convergencia.
