# FinScope Analytics v0.20 — Análisis transversal de consistencia post-tareas

**Modo:** `STRICTLY READ-ONLY`  
**Fecha:** 2026-07-21  
**Resultado:** `implementationReadiness=BLOCKED`  
**Baseline activo que continúa vigente:** `FinScope_Analytics_SpecDev_ChatGPT_v0.20_tasks_ready.zip`

## Resumen ejecutivo

El paquete supera íntegramente la validación física: el SHA-256 coincide con el sidecar canónico, CRC válido, raíz única, extracción segura, manifiesto/inventario consistentes, 26 schemas compilables y 368 archivos leídos. El alcance MVP y la arquitectura normativa también permanecen alineados: SEC-only, CIK-first, Company Facts primario, precio opcional CSV/manual, Svelte 5/Vite, Web Worker, IndexedDB local opt-in y Cloudflare Pages/Workers/D1 Free.

La cobertura **nominal** es completa: 49/49 requisitos y 84/84 criterios tienen tareas y al menos una ruta de prueba; 109/109 tareas tienen requisito, AC y autoridad. Sin embargo, la cobertura **ejecutable** no es completa. Se identificaron dependencias semánticas ausentes, consumidores desconectados, tareas de validación que no alcanzan sus productores, una remediación WCAG sin archivos fuente, controles SEC/IndexedDB subespecificados y una contradicción constitucional que inserta una segunda fase de análisis después de implementación.

Hallazgos: **1 CRITICAL**, **10 HIGH**, **2 MEDIUM**, **0 LOW**. Por los gates definidos, el proyecto no puede pasar a implementación.

## Integridad y baseline utilizado

| Control | Resultado |
|---|---|
| ZIP lógico | FinScope_Analytics_SpecDev_ChatGPT_v0.20_tasks_ready.zip |
| Raíz interna | FinScope_v0.20/ |
| SHA-256 real | 2db689c928e92961057a601301c9f3c260e93bf1f4c94cfa03db8a1c816c7be7 |
| SHA-256 sidecar | 2db689c928e92961057a601301c9f3c260e93bf1f4c94cfa03db8a1c816c7be7 |
| Coincidencia | Sí |
| Sidecar canónico | Sí |
| CRC | Válido |
| Entradas/archivos leídos | 368 / 368 |
| Manifiesto | 367 entradas; hashes y rutas conformes |
| Inventario | 366 entradas; hashes, tamaños y rutas conformes |
| Schemas | 26/26 compilan |
| Extracción segura | Sin traversal, rutas absolutas, symlinks, duplicados ni colisiones case-fold |
| Contenido | Sin archivos vacíos, temporales, dependencias regenerables, secretos ni comprimidos anidados |
| .specify | Integridad interna conforme; `extensions.yml` ausente; integración activa `generic` |
| Árbol modificado | No |

## Alcance confirmado

- Universo SEC-only; identidad primaria CIK normalizado a 10 dígitos.
- Company Facts primario; Company Concept fallback exacto, ordenado y acotado; Frames no selecciona facts de un emisor.
- Sin promesa CNV/global no SEC, sin proveedor automático de precio y sin credenciales de mercado.
- Precio histórico opcional por CSV o entrada manual; no bloquea fundamentales ni habilita valuación.
- Sin automatización con la aplicación cerrada; apertura/reanudación solo con consentimiento; refresh manual por botón de dominio.
- Insights descriptivos, no personalizados y sin buy/sell/hold, target price ni promesas de retorno.
- Servicios activos: Pages, Workers Free y D1 Free. Servicios no usados: Pages Functions, KV, R2, Queues, Durable Objects y Cron.

## Métricas recalculadas

| Métrica | Recuento físico | Expectativa | Estado |
|---|---:|---:|---|
| FR | 42 | 42 | CONFORME |
| NFR | 7 | 7 | CONFORME |
| Requisitos totales | 49 | 49 | CONFORME |
| AC | 84 | 84 | CONFORME |
| Tareas | 109 | 109 | CONFORME |
| Fases de tareas | 10 | 10 | CONFORME |
| Tareas [P] | 41 | — | CONFORME |
| User stories | 6 | — | CONFORME |
| Componentes del plan | 10 | — | CONFORME |
| Fórmulas | 15 | 15 | CONFORME |
| Vectores fórmula positivos | 36 | 36 | CONFORME |
| Vectores fórmula negativos | 7 | — | CONFORME |
| Métricas fundamentales | 24 | 24 | CONFORME |
| Métricas históricas de precio | 8 | 8 | CONFORME |
| Vectores métricos | 96 | — | CONFORME |
| Reglas de insights | 9 | 9 | CONFORME |
| Vectores de reglas | 27 | — | CONFORME |
| WCAG A/AA | 55 | 55 | CONFORME |
| Schemas | 26 | — | CONFORME |
| Contratos físicos | 20 | — | CONFORME |
| Archivos de fixtures | 29 | — | CONFORME |
| Escenarios AC | 84 | — | CONFORME |
| Autoridades | 35 | — | CONFORME |
| Mappings XBRL | 32 | — | CONFORME |

## Cobertura nominal y cobertura ejecutable

| Control | Resultado |
|---|---|
| Requisitos con tareas | 49/49 (100%) |
| Requisitos con ruta de prueba | 49/49 (100%) |
| AC con tareas | 84/84 (100%) |
| AC con ruta de prueba | 84/84 (100%) |
| Tareas con requisito | 109/109 |
| Tareas con AC | 109/109 |
| Tareas con autoridad | 109/109 |
| Tareas con alguna ruta `tests/` | 102/109 |
| Tareas de implementación/config sin prueba | 0 |
| Cobertura nominal | COMPLETA |
| Cobertura ejecutable | BLOQUEADA por hallazgos semánticos |

Las siete tareas sin ruta `tests/` son T010, T099, T104, T105, T106, T107 y T109; son documentación o cierre de evidencia, no tareas de implementación/configuración. El bloqueo no proviene del conteo, sino de que varias tareas y validaciones pueden ejecutarse antes de los productores que sus propios criterios requieren.

## Tabla principal de hallazgos

| ID | Severidad | Dominio | Hallazgo | Elementos afectados | Remediación requerida |
|---|---|---|---|---|---|
| ANA-001 | **CRITICAL** | Constitution / phase gates | Phase 10, the dependency graph and T109 state that final validation leads to a separate analysis and that the gate remains closed pending that analysis. Constitution 3.1.0 XII.1 requires analysis → implementation → conv… | T109 | Reframe T109 and the dependency graph as convergence-input / post-implementation convergence evidence. Do not add or reopen an analysis phase after implementation. Preserve implementationAuthorized=false until the curre… |
| ANA-002 | **HIGH** | Financial determinism | T042 implements 24 fundamental metrics but omits T041 even though every active metric resolves to a closed formula definition, and omits T043 despite claiming quality gates. T067 has the same defect for eight price metr… | T042, T067 | Declare the actual producer-consumer dependencies and remove unrelated cross-domain prerequisites. Ensure fundamental and price metric tasks consume the single formula engine and the authorized quality classifier. |
| ANA-003 | **HIGH** | Fundamental analysis pipeline | T045 synthesizes rule outcomes without depending on T044; T048 publishes a normalization/analysis candidate without depending on T047 candidate builders; T053 claims metric and insight acceptance without waiting for T05… | T045, T048, T053 | Add the missing producer dependencies and make the first-analysis E2E close the entire cited behavior from CIK through metrics, rules, synthesis and fingerprints. |
| ANA-004 | **HIGH** | Refresh / consent / cache | T060 implements consent-aware open/resume before T072 creates separate refresh/storage consent records. T061 promises quota/fair-access enforcement without depending on the quota guard. T062 claims stale, cancellation a… | T060, T061, T062, T072, T090 | Move or split the consent foundation before lifecycle orchestration, connect manual/open-resume flows to idempotency, retry, degradation and quota guards, and make T062 depend on every exercised implementation. |
| ANA-005 | **HIGH** | Historical price overlay | T065 depends on refresh UI rather than CSV/manual parsers; T066 depends on fundamental synthesis/refresh and omits price inputs and fingerprint service; T068 omits overlay/metric producers; T069/T070/T071 omit the servi… | T063, T064, T065, T066, T067, T068, T069, T070, T071 | Rebuild the story DAG around the normative data flow and keep all fundamental dependencies limited to shared types/fingerprint primitives, not fundamental synthesis or refresh UI. |
| ANA-006 | **HIGH** | IndexedDB / export / restore / deletion | Export depends on price UIs instead of record repositories; restore and delete omit preview/repository prerequisites; the data-management UI omits the services it exposes; persistence E2E omits restore/delete/UI tasks. … | T073, T074, T075, T076, T077, T078, T079, T080 | Connect repositories to export/restore/delete services, connect services to UI, and require the full service/UI chain before persistence E2E and final integration validation. |
| ANA-007 | **HIGH** | Accessibility WCAG 2.2 AA | T086 says it adds names/instructions/errors to all forms/actions but lists only a test file. T087/T088/T104 do not wait for the complete accessibility implementation and user flows; T085 is a leaf and T088 is outside T1… | T083, T084, T085, T086, T087, T088, T104, T109 | Give T086 exact product files or split it by feature UI; make automated/manual/final reviews depend on all applicable UI and accessibility tasks; preserve explicit manual oracles and N/A reopen triggers. |
| ANA-008 | **HIGH** | Cloudflare Free / performance / observability | T105 claims quota/build/CPU/memory/subrequest/D1/degradation validation but omits T093–T096. T093 is a graph leaf. T095 does not depend on streaming implementation T028, and T096 omits the persistence implementations wh… | T090, T091, T092, T093, T094, T095, T096, T099, T105 | Make validation depend on every budget producer, make performance tests depend on measured implementations, and finalize deployment/rollback documentation after the evidence and degradation controls exist. |
| ANA-009 | **HIGH** | Final verification / release evidence | The aggregate unit/integration/E2E tasks omit suites and implementations named in their descriptions. T109 reaches only 94 of 109 tasks and excludes 15 tasks, including restore, accessibility, Cloudflare, documentation … | T100, T101, T102, T103, T105, T106, T107, T108, T109 | Define explicit aggregate suite membership or commands, make each aggregate task depend on all relevant producers, and make the final convergence-input report transitively include every required implementation, validati… |
| ANA-010 | **HIGH** | SEC EDGAR / security boundary | NFR-003 and the security contract require SEC_USER_AGENT and SEC_CONTACT_EMAIL deployment variables. No task names, validates or fails closed on those variables. A cross-host redirect negative fixture exists, but no tas… | T007, T026, T028, T030, T035, T097 | Add exact Worker environment bindings, startup/request fail-closed behavior, outbound header construction, redirect=manual/allowlist revalidation, redaction tests and frozen positive/negative contract oracles. |
| ANA-011 | **HIGH** | IndexedDB integrity / privacy | The security and browser-storage authorities require corrupt/hash-mismatched records to be quarantined and excluded from active pointers. T080 mentions corruption E2E, but no task implements read-path verification, quar… | T021, T073, T076, T077, T080, T082 | Add an explicit repository/read-path integrity and quarantine task with schema/hash validation, pointer exclusion/repair, visible recovery action and deterministic tests. |
| ANA-012 | **MEDIUM** | Parallelism | The example says to run T011–T015 in parallel after T010, but T015 depends on T012 and several tasks require T001/T002/T005 rather than T010 alone. | T010, T011, T012, T013, T014, T015 | Replace examples with explicit dependency-respecting waves and state that [P] means parallel only after every declared prerequisite is complete. |
| ANA-013 | **MEDIUM** | Dependency graph quality | Examples include T057→T052, T065→T060/T061, T066→T045/T062, T091→T086, T094→T086 and T095→T088. These edges are not justified by files, contracts or data flow. | T052, T057, T060, T061, T062, T065, T066, T086, T088, T091, T094, T095 | Remove non-material edges, replace them with authority/interface prerequisites, and rerun cycle, reachability, file-collision and semantic dependency checks. |

### Detalle y evidencia

#### ANA-001 — CRITICAL — The task plan inserts a second “analysis” after implementation instead of convergence

**Impacto:** A subordinate task artifact changes the constitutional lifecycle and leaves the post-implementation gate transition undefined. This is a direct phase-order conflict.

**Evidencia:**
- Constitution XII.1: mandatory order ends analysis → implementation → convergence.
- tasks.md Phase 10: “prepare evidence for the separate analysis phase”.
- tasks.md dependency graph: “final validation → separate analysis”.
- T109 Done when: gate remains closed pending separate analysis.

**Tareas:** T109  
**Requisitos:** NFR-005, NFR-006  
**AC:** AC-077, AC-083, AC-084  
**Remediación:** Reframe T109 and the dependency graph as convergence-input / post-implementation convergence evidence. Do not add or reopen an analysis phase after implementation. Preserve implementationAuthorized=false until the current analysis passes.

#### ANA-002 — HIGH — Metric tasks do not depend on the formula and quality implementations they normatively consume

**Impacto:** Implementers can duplicate arithmetic or invent interfaces, defeating ROUND_HALF_EVEN, DecimalString, reason precedence and deterministic quality classification.

**Evidencia:**
- metric-catalog.json assigns formulaId to all 32 active metrics.
- AC-028 requires every active metric to resolve to exactly one closed FormulaDefinition.
- T041 implements the 15 formula definitions; T043 implements the quality classifiers.
- T042 dependencies: T039,T040. T067 dependencies: T040,T042,T063.

**Tareas:** T042, T067  
**Requisitos:** FR-013, FR-014, FR-015, FR-016, FR-019, FR-023, NFR-001  
**AC:** AC-016, AC-017, AC-025, AC-026, AC-027, AC-028, AC-050, AC-051, AC-052  
**Remediación:** Declare the actual producer-consumer dependencies and remove unrelated cross-domain prerequisites. Ensure fundamental and price metric tasks consume the single formula engine and the authorized quality classifier.

#### ANA-003 — HIGH — Synthesis, Web Worker publication and first-analysis E2E can execute before their required producers

**Impacto:** The first vertical slice may be declared complete while metrics, rules, synthesis or immutable candidates are absent or only stubbed.

**Evidencia:**
- AC-036 precondition is “rule outcomes set”; T044 is the rule evaluator, but T045 depends only on T043.
- T047 builds FundamentalBundle/FundamentalAnalysis candidates; T048 depends only on T023,T046.
- T053 cites FR-013, FR-017, AC-028 and AC-035 but omits metric and insight UI tasks T051,T052.

**Tareas:** T045, T048, T053  
**Requisitos:** FR-001, FR-003, FR-007, FR-008, FR-013, FR-017, FR-019, FR-025, FR-033, FR-035, FR-037, NFR-001, NFR-004  
**AC:** AC-001, AC-005, AC-010, AC-011, AC-028, AC-035, AC-036, AC-039, AC-059, AC-060, AC-061, AC-062, AC-073  
**Remediación:** Add the missing producer dependencies and make the first-analysis E2E close the entire cited behavior from CIK through metrics, rules, synthesis and fingerprints.

#### ANA-004 — HIGH — Refresh orchestration is sequenced before its consent repository and its E2E omits required flows

**Impacto:** Network can be triggered with ambiguous consent state, and the story-level E2E can pass without testing the user-visible refresh paths it claims to close.

**Evidencia:**
- CLR-023 and update-orchestration require distinct refreshConsent and storageConsent.
- T072 is the only task that implements consent records/revocation, but it occurs two phases after T060.
- T061 Done when says manual refresh never bypasses quota guards; T090 implements those guards later.
- T062 dependencies exclude stale degradation T059, open/resume T060 and manual refresh T061.

**Tareas:** T060, T061, T062, T072, T090  
**Requisitos:** FR-030, FR-031, FR-032, FR-033, FR-034, FR-035, FR-041, FR-042, NFR-002, NFR-003, NFR-004, NFR-005  
**AC:** AC-004, AC-047, AC-056, AC-058, AC-059, AC-060, AC-061, AC-062, AC-065, AC-066, AC-070, AC-071, AC-072, AC-073, AC-075, AC-076, AC-077  
**Remediación:** Move or split the consent foundation before lifecycle orchestration, connect manual/open-resume flows to idempotency, retry, degradation and quota guards, and make T062 depend on every exercised implementation.

#### ANA-005 — HIGH — The price story dependency graph is cross-wired and does not close parser → preview → overlay → metrics → events → UI → E2E

**Impacto:** Price processing can be built against undefined inputs, E2E can run without event/UI integration, and the fundamental/price isolation invariant may remain unproven.

**Evidencia:**
- T065 dependencies are T060,T061 instead of T063,T064.
- T066 dependencies are T014,T045,T062 and omit T046,T063,T064,T065.
- T068 omits T066,T067; T070 omits T067; T071 omits T068,T069,T070.
- The story requires import/replace/delete isolation and all eight metrics.

**Tareas:** T063, T064, T065, T066, T067, T068, T069, T070, T071  
**Requisitos:** FR-013, FR-016, FR-020, FR-021, FR-022, FR-023, FR-024, FR-026, FR-028, FR-033, FR-039, FR-041, FR-042, NFR-001, NFR-002  
**AC:** AC-028, AC-037, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054, AC-055, AC-063, AC-067, AC-068, AC-069, AC-070, AC-074, AC-078, AC-079  
**Remediación:** Rebuild the story DAG around the normative data flow and keep all fundamental dependencies limited to shared types/fingerprint primitives, not fundamental synthesis or refresh UI.

#### ANA-006 — HIGH — Persistence lifecycle consumers are not connected to repositories and restore/delete services

**Impacto:** Atomic restore, rollback, pre-export and delete semantics can remain unintegrated while the user story and final lifecycle are marked complete.

**Evidencia:**
- T075 dependencies omit T073,T074.
- T077 omits T076,T073,T074; T078 omits T073,T074,T075.
- T079 omits T075–T078; T080 omits T076–T079.
- Graph leaf T077 is never consumed by UI, E2E or final validation.

**Tareas:** T073, T074, T075, T076, T077, T078, T079, T080  
**Requisitos:** FR-021, FR-022, FR-034, FR-035, FR-036, FR-039, FR-041, FR-042, NFR-002, NFR-004  
**AC:** AC-049, AC-056, AC-057, AC-058, AC-063, AC-068, AC-069, AC-070, AC-073, AC-075, AC-076, AC-078  
**Remediación:** Connect repositories to export/restore/delete services, connect services to UI, and require the full service/UI chain before persistence E2E and final integration validation.

#### ANA-007 — HIGH — The accessibility remediation task has no product source paths and final WCAG closure omits required work

**Impacto:** Mandatory labels, error associations, reflow, contrast, target size and manual criteria can be absent while the conformance report claims 55/55 closure.

**Evidencia:**
- T086 files: tests/e2e/accessibility/names-errors.spec.ts only.
- T087 omits T083–T086; T088 depends only on T083; T104 depends only on T083,T084.
- The active matrix contains 55 A/AA criteria, 43 applicable and 12 justified N/A.
- Axe is explicitly supplemental, not a substitute for manual verification.

**Tareas:** T083, T084, T085, T086, T087, T088, T104, T109  
**Requisitos:** FR-037, FR-041, FR-042, NFR-005, NFR-006, NFR-007  
**AC:** AC-067, AC-068, AC-069, AC-070, AC-071, AC-072, AC-073, AC-074, AC-075, AC-077, AC-083, AC-084  
**Remediación:** Give T086 exact product files or split it by feature UI; make automated/manual/final reviews depend on all applicable UI and accessibility tasks; preserve explicit manual oracles and N/A reopen triggers.

#### ANA-008 — HIGH — Cloudflare validation does not depend on the D1, build and performance evidence it claims to validate

**Impacto:** The documented zero-cost and runtime-safety gate may be issued without the measurements named in its own Done-when criterion.

**Evidencia:**
- T105 dependencies stop at T092 and exclude T093,T094,T095,T096.
- T095 dependencies: T027,T088; streaming implementation is T028.
- T096 dependencies omit T073–T080 despite measuring IndexedDB.
- T099 runbook can complete before degradation/observability/performance/security tasks T091–T098.

**Tareas:** T090, T091, T092, T093, T094, T095, T096, T099, T105  
**Requisitos:** FR-003, FR-021, FR-031, FR-032, FR-037, FR-041, NFR-003, NFR-004, NFR-005  
**AC:** AC-003, AC-004, AC-009, AC-047, AC-054, AC-057, AC-058, AC-065, AC-066, AC-072, AC-075, AC-077, AC-081, AC-083  
**Remediación:** Make validation depend on every budget producer, make performance tests depend on measured implementations, and finalize deployment/rollback documentation after the evidence and degradation controls exist.

#### ANA-009 — HIGH — Final validation and T109 do not transitively cover the implementation tree

**Impacto:** A final evidence report can be generated without all release gates, invalidating the claimed implementation readiness and preventing reversible traceability from final proof back to each task.

**Evidencia:**
- T100 omits T011,T017,T044,T046,T054 despite naming decimal/state/rules/fingerprints/cache.
- T102 omits acquisition runner, Web Worker pipeline, idempotency and restore service.
- T103 omits story-level E2Es T053,T062,T071,T080 and full accessibility closure.
- T109 transitive closure excludes T010,T019,T077,T085,T088,T091–T096,T105–T108.

**Tareas:** T100, T101, T102, T103, T105, T106, T107, T108, T109  
**Requisitos:** FR-001, FR-003, FR-008, FR-010, FR-013, FR-014, FR-016, FR-017, FR-020, FR-021, FR-023, FR-025, FR-030, FR-031, FR-032, FR-034, FR-035, FR-037, FR-041, FR-042, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-006  
**AC:** AC-001, AC-004, AC-009, AC-011, AC-014, AC-019, AC-028, AC-029, AC-033, AC-034, AC-035, AC-039, AC-043, AC-044, AC-045, AC-048, AC-049, AC-051, AC-053, AC-054, AC-057, AC-058, AC-065, AC-066, AC-067, AC-072, AC-073, AC-074, AC-075, AC-077, AC-081, AC-082, AC-083, AC-084  
**Remediación:** Define explicit aggregate suite membership or commands, make each aggregate task depend on all relevant producers, and make the final convergence-input report transitively include every required implementation, validation and documentation task.

#### ANA-010 — HIGH — Mandatory SEC User-Agent/contact and redirect handling lack an explicit implementation task and oracle

**Impacto:** The implementation could violate SEC fair-access identification or follow an untrusted redirect while still satisfying the present task wording.

**Evidencia:**
- NFR-003: User-Agent/contact mandatory.
- security-and-input-limits.json requiredDeploymentVariables: SEC_USER_AGENT, SEC_CONTACT_EMAIL.
- No occurrence of those names or User-Agent exists in tasks.md.
- Fixture sec-cross-host-redirect exists; T097 source paths do not include the gateway fetch/redirect path.

**Tareas:** T007, T026, T028, T030, T035, T097  
**Requisitos:** FR-003, FR-004, FR-005, FR-006, FR-007, FR-039, FR-040, NFR-002, NFR-003, NFR-005  
**AC:** AC-003, AC-004, AC-005, AC-006, AC-007, AC-008, AC-009, AC-020, AC-043, AC-046, AC-053, AC-055, AC-076, AC-081, AC-082  
**Remediación:** Add exact Worker environment bindings, startup/request fail-closed behavior, outbound header construction, redirect=manual/allowlist revalidation, redaction tests and frozen positive/negative contract oracles.

#### ANA-011 — HIGH — Runtime quarantine of corrupt local records is tested but has no implementation task

**Impacto:** A corrupt record may remain active, crash the application or be silently discarded, violating local-first integrity and recoverability.

**Evidencia:**
- security-and-input-limits.json corruptionRecovery requires quarantine and active-pointer exclusion.
- browser-storage.md repeats the same requirement.
- T076 covers restore candidates; T073 covers writes; neither implements existing-record read-path quarantine.
- T080 cannot test a missing corruption-recovery implementation.

**Tareas:** T021, T073, T076, T077, T080, T082  
**Requisitos:** FR-034, FR-035, FR-036, FR-039, FR-041, NFR-002, NFR-004  
**AC:** AC-002, AC-047, AC-048, AC-056, AC-057, AC-058, AC-073, AC-075, AC-076  
**Remediación:** Add an explicit repository/read-path integrity and quarantine task with schema/hash validation, pointer exclusion/repair, visible recovery action and deterministic tests.

#### ANA-012 — MEDIUM — The published parallel execution example violates declared dependencies

**Impacto:** A manual implementer can start tasks in an invalid wave and create temporary incompatible interfaces or failed tests.

**Evidencia:**
- tasks.md parallel example: “After T010, run T011–T015 … in parallel”.
- T015 Depends on T012; T011/T012/T014 have other setup prerequisites.

**Tareas:** T010, T011, T012, T013, T014, T015  
**Requisitos:** FR-008, FR-014, FR-024, FR-025, FR-027, FR-029, NFR-001, NFR-005, NFR-006  
**AC:** AC-019, AC-020, AC-026, AC-027, AC-028, AC-033, AC-034, AC-039, AC-040, AC-041, AC-042, AC-043, AC-045, AC-064, AC-077, AC-079, AC-083, AC-084  
**Remediación:** Replace examples with explicit dependency-respecting waves and state that [P] means parallel only after every declared prerequisite is complete.

#### ANA-013 — MEDIUM — Several dependencies serialize unrelated domains while omitting actual prerequisites

**Impacto:** The DAG over-serializes implementation, obscures true producer-consumer relationships and makes the stated parallelism misleading.

**Evidencia:**
- Idempotency depends on the insight UI.
- Price preview/overlay depend on refresh UI/fundamental synthesis.
- Quota/build/performance tasks depend on accessibility tasks rather than measured runtime producers.

**Tareas:** T052, T057, T060, T061, T062, T065, T066, T086, T088, T091, T094, T095  
**Requisitos:** FR-003, FR-017, FR-018, FR-019, FR-020, FR-021, FR-022, FR-024, FR-026, FR-028, FR-030, FR-031, FR-032, FR-033, FR-035, FR-037, FR-041, FR-042, NFR-001, NFR-002, NFR-003, NFR-004, NFR-005, NFR-007  
**AC:** AC-003, AC-004, AC-009, AC-033, AC-034, AC-035, AC-036, AC-037, AC-047, AC-049, AC-050, AC-053, AC-054, AC-055, AC-058, AC-059, AC-060, AC-061, AC-062, AC-063, AC-065, AC-066, AC-067, AC-068, AC-069, AC-070, AC-071, AC-072, AC-073, AC-074, AC-075, AC-077, AC-078, AC-079, AC-081, AC-083  
**Remediación:** Remove non-material edges, replace them with authority/interface prerequisites, and rerun cycle, reachability, file-collision and semantic dependency checks.

## Causas raíz

- **RC-01 — Dependency QA was syntactic, not semantic:** The baseline correctly checks unique IDs, existing edges and cycles, but does not prove producer-consumer reachability, final-gate closure or data-flow prerequisites. Hallazgos: ANA-002, ANA-003, ANA-004, ANA-005, ANA-006, ANA-008, ANA-009, ANA-013.
- **RC-02 — Coverage mappings were treated as implementation proof:** A requirement/AC is mapped to a task with a test path, yet the task or aggregate validation can run before the behavior or remediation it claims to verify. Hallazgos: ANA-003, ANA-007, ANA-008, ANA-009.
- **RC-03 — Cross-story sequencing mixes UI, domain and persistence readiness:** UI tasks are used as prerequisites for domain services, while the true repositories, protocols or event producers are omitted or scheduled later. Hallazgos: ANA-004, ANA-005, ANA-006, ANA-013.
- **RC-04 — Exact external-policy controls are not decomposed into executable tasks:** WCAG remediation, SEC identification/redirect controls and IndexedDB quarantine are present in authorities or tests but lack exact product source paths and measurable implementation oracles. Hallazgos: ANA-007, ANA-010, ANA-011.
- **RC-05 — Post-implementation governance terminology is inconsistent with the constitution:** The task plan carries forward a “separate analysis” after implementation instead of producing evidence for the constitutionally next convergence phase. Hallazgos: ANA-001, ANA-009.

## Alineamiento constitucional y gates

- El baseline y el estado de fase autorizan tareas y análisis, pero mantienen implementación y convergencia cerradas.
- No existe implementación prematura ni modificación física de `.specify`.
- **No conformidad constitucional:** ANA-001. `tasks.md` introduce una segunda “separate analysis” después de implementación; la Constitución 3.1.0 exige que la fase siguiente sea convergencia.

```text
tasksAuthorized=true
analysisAuthorized=true
implementationAuthorized=false
convergenceAuthorized=false
```

## Dependencias, ciclos y paralelismo

- Grafo declarado: 109 nodos, 295 aristas, 8 raíces, 9 hojas, 0 IDs inexistentes, 0 dependencias hacia IDs posteriores y 0 ciclos sintácticos.
- Camino declarado más largo: T001 → T012 → T018 → T026 → T027 → T028 → T030 → T036 → T039 → T042 → T044 → T047 → T053 → T061 → T065 → T069 → T075 → T080 → T087 → T099 → T109 (20 aristas).
- T109 alcanza transitivamente 94/109 tareas; quedan fuera: T010, T019, T077, T085, T088, T091, T092, T093, T094, T095, T096, T105, T106, T107, T108.
- Colisiones de archivo entre tareas `[P]` de la misma fase: 0.
- Archivo compartido serializado: `workers/sec-gateway/src/observability.ts` por T019 y T092; no es colisión porque T092 depende de T019.
- Existen relaciones `[P]`→`[P]` que exigen ondas explícitas y el ejemplo “T011–T015 en paralelo” contradice T015→T012.

## Arquitectura frontend y runtime

La arquitectura normativa es consistente: Svelte 5 SPA, TypeScript strict, Vite, sin SvelteKit, separación UI/dominio, Web Worker tipado, Vitest, Playwright y accesibilidad con HTML/SVG más alternativa tabular. No se detectaron rutas que introduzcan React, SvelteKit, ORM IndexedDB, framework de gateway o servicios Cloudflare no autorizados. El bloqueo está en la secuencia y ejecutabilidad de tareas, no en la selección tecnológica.

## Dominio financiero y determinismo

Las autoridades cierran `decimal.js`, `ROUND_HALF_EVEN`, DecimalString, 15 fórmulas, 36 vectores positivos, 7 negativos, 24 métricas fundamentales, 8 de precio, 9 reglas, snapshots fundamentales inmutables, overlay independiente, fingerprints separados y exclusión del reloj local. No se detectó valuación activa. ANA-002/003/005 bloquean porque el DAG permite implementar métricas, síntesis y precio sin sus motores normativos.

## SEC EDGAR y XBRL

Las autoridades internas coinciden con la documentación oficial vigente: CIK-first, Submissions/Company Facts, Company Concept exacto y selectivo, Frames fuera de selección de facts, fair access y máximo interno de 14 llamadas. Los 32 mappings son exactos y versionados, sin fuzzy inference. ANA-010 bloquea porque User-Agent/contacto y redirect manual/allowlist no están convertidos en una tarea explícita y verificable.

## Web Worker, IndexedDB, actualización y restore

Los contratos definen mensajes discriminados, operation IDs, cancelación, concurrencia uno, publicación atómica, CAS de pointers, rollback, consentimiento separado, export/restore local y migración compatible preview-only. ANA-004/006/011 bloquean la secuencia: consentimiento llega después del lifecycle, restore/delete no llegan a UI/E2E y la cuarentena de corrupción carece de implementación explícita.

## Seguridad y privacidad

CSP, CORS same-origin, XSS, prototype pollution, path traversal, archive rejection, CSV injection, límites, checksums, logs redactados, supply chain y privacidad local-first están normados. La matriz de tareas no materializa con suficiente precisión el User-Agent/contacto, redirects ni la cuarentena de registros locales corruptos. No se hallaron secretos o datos sensibles en el paquete.

## Accesibilidad WCAG 2.2

La matriz física contiene 55 criterios A/AA: 43 aplicables y 12 N/A con trigger de reapertura. Todas las referencias AC/tarea/prueba resuelven nominalmente. ANA-007 impide aceptar la cobertura porque T086 no tiene archivos fuente y los cierres automatizado, manual y final no dependen de todo el trabajo accesible. Axe continúa siendo solo evidencia suplementaria.

## Cloudflare Free

La revalidación oficial del 2026-07-21 no detectó cambios incompatibles con el baseline: Pages Free 500 builds/mes, 20.000 archivos y 25 MiB por asset; Workers Free 100.000 requests/día, 10 ms CPU, 128 MiB, 50 subrequests y 3 MiB de bundle; D1 Free 5 M rows read/día, 100.000 writes/día, 5 GiB de cuenta, 500 MiB/base y 50 queries/invocación. Los presupuestos internos son mucho más conservadores. La arquitectura es viable en Free; el bloqueo ANA-008/009 es de evidencia y dependencias, no de cuota.

## Riesgos de runtime

- Workers Free CPU target (4 ms p95) is conservative and must be measured against large streamed SEC payloads.
- Browser memory and long-task behavior for 64 MiB SEC responses and 50,000-row CSV imports remains an implementation-time risk.
- IndexedDB eviction/corruption must surface deterministic local recovery and cannot silently advance pointers.
- SEC schema/taxonomy drift requires exact mapping/version governance and partial results, never fuzzy inference.
- Manual WCAG evidence is required for criteria not reliably automatable.

## Riesgos post-MVP

- CNV, non-SEC global coverage, automated market providers, valuation and background schedulers remain deliberately deferred.
- Any future Cloudflare service or paid tier requires a new Spec-Driven cycle and cannot be introduced by implementation convenience.
- Future IndexedDB/D1 migrations require explicit versioned authorities and rollback evidence.

## Fuentes oficiales consultadas

- Cloudflare Workers platform limits: `https://developers.cloudflare.com/workers/platform/limits/`
- Cloudflare Workers pricing: `https://developers.cloudflare.com/workers/platform/pricing/`
- Cloudflare Pages limits: `https://developers.cloudflare.com/pages/platform/limits/`
- Cloudflare D1 limits: `https://developers.cloudflare.com/d1/platform/limits/`
- Cloudflare D1 pricing: `https://developers.cloudflare.com/d1/platform/pricing/`
- SEC EDGAR Application Programming Interfaces: `https://www.sec.gov/search-filings/edgar-application-programming-interfaces`
- SEC Developer Resources / Fair Access: `https://www.sec.gov/about/developer-resources`
- W3C Web Content Accessibility Guidelines (WCAG) 2.2: `https://www.w3.org/TR/WCAG22/`

## Readiness para implementación

```text
implementationReadiness=BLOCKED
```

Motivo: existe 1 hallazgo CRITICAL y 10 HIGH. Aunque la cobertura nominal es 100 %, no se cumplen los gates de cero contradicciones constitucionales, dependencias ejecutables, WCAG obligatorio, seguridad/SEC explícitos, restore íntegro y cierre completo de validaciones.

## Siguiente acción exacta

Ejecutar una **remediación documental post-análisis sobre v0.20**, limitada a ANA-001..ANA-013; reconstruir el DAG y la clausura de validaciones; volver a ejecutar este análisis completo desde cero; y solo si el nuevo resultado tiene cero CRITICAL/HIGH y todos los gates efectivos conformes, generar un baseline posterior con `implementationAuthorized=true`. Hasta entonces continúa activo v0.20 y no debe implementarse código.
