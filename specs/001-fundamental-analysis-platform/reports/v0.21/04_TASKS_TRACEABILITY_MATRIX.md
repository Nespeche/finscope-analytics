# Matriz activa requisito/AC → tarea — v0.21

**Baseline fuente SHA-256:** `2db689c928e92961057a601301c9f3c260e93bf1f4c94cfa03db8a1c816c7be7`  
**Cobertura nominal y ejecutable:** `APPROVED`

## Resumen

| Control | Resultado |
|---|---|
| Requisitos con tareas/pruebas | 49/49 |
| AC con tareas/pruebas | 84/84 |
| Tareas con requisito/AC/autoridad | 109/109 |
| Implementación/config sin prueba | 0 |
| Ciclos / dependencias inválidas / colisiones [P] | 0 / 0 / 0 |
| Clausura T109 | 109/109 |

## Requisito → AC → plan → tarea → archivo/prueba

| Requisito | Texto abreviado | Componente | AC | Tareas | Pruebas | Autoridades | Estado |
|---|---|---|---|---|---:|---|---|
| FR-001 | CIK de 10 dígitos es la identidad primaria; ticker es alias no autoritativo. | COMP-IDENTITY | AC-001, AC-003 | T024, T025, T049, T053, T103 | 5 | AUTH-003, AUTH-005 | EXECUTABLE_AND_TESTED |
| FR-002 | una coincidencia ambigua produce `identity_ambiguous` local; nunca selección automática. | COMP-IDENTITY | AC-002 | T024, T025 | 2 | AUTH-020 | EXECUTABLE_AND_TESTED |
| FR-003 | una operación SEC tiene presupuesto fijo de 14 llamadas externas. | COMP-SEC-GATEWAY | AC-003, AC-009, AC-081 | T007, T026, T028, T030, T032, T035, T053, T056, T095, T102 | 12 | AUTH-005 | EXECUTABLE_AND_TESTED |
| FR-004 | Submissions y Company Facts se solicitan antes de cualquier Company Concept. | COMP-SEC-GATEWAY | AC-005, AC-006, AC-081 | T028, T030, T031, T032, T035 | 7 | AUTH-005 | EXECUTABLE_AND_TESTED |
| FR-005 | Company Concept se solicita solo para conceptos no resueltos, allowlisted y con mapping exacto … | COMP-SEC-GATEWAY | AC-007, AC-081 | T028, T032, T035 | 5 | AUTH-005 | EXECUTABLE_AND_TESTED |
| FR-006 | el orden de fallback es estable: allowlist del perfil → prioridad de métrica → precedencia de m… | COMP-SEC-GATEWAY | AC-008, AC-013, AC-081 | T028, T032, T035, T036 | 6 | AUTH-005, AUTH-006 | EXECUTABLE_AND_TESTED |
| FR-007 | agotado el presupuesto, se publica resultado `partial` si hay payload utilizable; no se ejecuta… | COMP-SEC-GATEWAY | AC-007, AC-009, AC-010, AC-081 | T028, T032, T033, T035, T048, T059 | 8 | AUTH-005 | EXECUTABLE_AND_TESTED |
| FR-008 | cada fact mantiene `factId`, concepto canónico, período, scope, decimal canónico, mapping/versi… | COMP-NORMALIZATION | AC-006, AC-011, AC-012, AC-015, AC-019, AC-020 | T011, T020, T031, T038, T039, T047, T049, T050, T053, T100 … (+2) | 11 | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-014, AUTH-026 | EXECUTABLE_AND_TESTED |
| FR-009 | los estados de fact resolution son `resolved\|absent\|ambiguous\|incompatible`. | COMP-NORMALIZATION | AC-010, AC-014, AC-020 | T038, T047, T050 | 3 | AUTH-005, AUTH-008, AUTH-026 | EXECUTABLE_AND_TESTED |
| FR-010 | la cobertura agregada usa `complete\|partial\|missing\|not_applicable`; no sustituye al estado del… | COMP-NORMALIZATION | AC-010, AC-011 | T047, T050, T106 | 2 | AUTH-005, AUTH-007 | EXECUTABLE_AND_TESTED |
| FR-011 | perfiles aplican allowlists de conceptos y métricas; elementos fuera de allowlist son `not_appl… | COMP-NORMALIZATION | AC-012, AC-013, AC-014, AC-016, AC-017, AC-018 … (+1) | T036, T037 | 2 | AUTH-004, AUTH-006, AUTH-008 | EXECUTABLE_AND_TESTED |
| FR-012 | `unsupported_profile` es un resultado local normal que conserva identidad, filings y evidencia;… | COMP-NORMALIZATION | AC-017, AC-018 | T037 | 1 | AUTH-004, AUTH-006 | EXECUTABLE_AND_TESTED |
| FR-013 | el catálogo ejecutable contiene exactamente 24 métricas fundamentales activas y 8 de precio act… | COMP-ANALYTICS | AC-016, AC-017, AC-028 | T037, T041, T042, T051, T053, T067, T100, T103, T106 | 8 | AUTH-006, AUTH-011 | EXECUTABLE_AND_TESTED |
| FR-014 | cada métrica declara fórmula, inputs, prioridad, perfiles, calidad mínima, rounding, consumidor… | COMP-ANALYTICS | AC-015, AC-026, AC-027, AC-028 | T011, T039, T041, T042, T051, T100 | 6 | AUTH-003, AUTH-006, AUTH-011 | EXECUTABLE_AND_TESTED |
| FR-015 | deuda usa buckets exactos no solapados; un total genérico o lease-inclusive no se usa sin mappi… | COMP-NORMALIZATION | AC-021, AC-022, AC-023, AC-024, AC-025 | T040, T042 | 2 | AUTH-006, AUTH-011 | EXECUTABLE_AND_TESTED |
| FR-016 | calidad fundamental y calidad de precio son modelos distintos y no comparten ejes implícitos. | COMP-ANALYTICS | AC-029, AC-030, AC-031, AC-032 | T043, T042, T051, T067, T100, T106 | 5 | AUTH-008 | EXECUTABLE_AND_TESTED |
| FR-017 | cada una de las 9 reglas activas usa AST validado por `rule-node.schema.json`, perfiles, calida… | COMP-ANALYTICS | AC-033, AC-034, AC-035, AC-036 | T044, T045, T052, T053, T089, T100, T106 | 6 | AUTH-012, AUTH-013 | EXECUTABLE_AND_TESTED |
| FR-018 | cada regla tiene tres fixtures: triggered, not_triggered y not_evaluable. | COMP-ANALYTICS | AC-034 | T044, T052 | 2 | AUTH-012 | EXECUTABLE_AND_TESTED |
| FR-019 | una regla nunca se evalúa si un input requerido está indisponible o por debajo de la calidad mí… | COMP-ANALYTICS | AC-025, AC-027, AC-030, AC-035 | T040, T043, T042, T044, T045, T052 | 6 | AUTH-006, AUTH-008, AUTH-011, AUTH-012 | EXECUTABLE_AND_TESTED |
| FR-020 | un bundle/snapshot fundamental no contiene overlay, métricas ni fingerprints de precio. | COMP-PRICE-OVERLAY | AC-011, AC-037, AC-049, AC-078 | T020, T047, T066, T071, T107 | 4 | AUTH-007, AUTH-009, AUTH-012, AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-021 | un overlay es inmutable por versión; reemplazarlo crea nueva versión y actualiza solo el pointe… | COMP-PRICE-OVERLAY | AC-049, AC-050, AC-054, AC-055, AC-063 | T020, T063, T064, T065, T066, T068, T069, T071, T074, T096 … (+1) | 13 | AUTH-009, AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-022 | importar o borrar precio no modifica bundle, análisis, snapshot ni pointer fundamental. | COMP-PRICE-OVERLAY | AC-054, AC-055, AC-063, AC-078 | T063, T064, T065, T066, T068, T069, T071, T074, T078 | 10 | AUTH-009, AUTH-014, AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-023 | precio se usa únicamente para métricas históricas descriptivas; no interviene en reglas fundame… | COMP-PRICE-OVERLAY | AC-037, AC-049, AC-050, AC-051, AC-052 | T067, T068, T070, T071, T089, T106 | 5 | AUTH-009, AUTH-012 | EXECUTABLE_AND_TESTED |
| FR-024 | `displayAgeDays`, `evaluationDate` y cualquier dato derivado del reloj son solo de presentación. | COMP-PRICE-OVERLAY | AC-051, AC-064, AC-079 | T014, T066, T070, T071 | 4 | AUTH-009, AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-025 | serialización canónica RFC 8785 JCS y SHA-256 con prefijo `sha256:`. | COMP-FINGERPRINTS | AC-019, AC-039, AC-040, AC-041 | T013, T046, T053, T100 | 4 | AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-026 | `fundamentalInputFingerprint`, `fundamentalAnalysisFingerprint`, `historicalPriceOverlayFingerp… | COMP-FINGERPRINTS | AC-042, AC-078 | T020, T046, T066 | 3 | AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-027 | fingerprints, timestamps de visualización y campos de reloj quedan excluidos de su propia proye… | COMP-FINGERPRINTS | AC-038, AC-041, AC-079 | T014, T046 | 2 | AUTH-009, AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-028 | cambiar evidencia opcional o precio no cambia fingerprints fundamentales. | COMP-FINGERPRINTS | AC-037, AC-038, AC-078 | T046, T066 | 2 | AUTH-012, AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-029 | toda publicación valida fingerprints contra test vectors. | COMP-FINGERPRINTS | AC-039, AC-040 | T013, T046 | 2 | AUTH-014 | EXECUTABLE_AND_TESTED |
| FR-030 | apertura/reanudación usa snapshot local sin red cuando `refreshConsent=false`. | COMP-ORCHESTRATION | AC-065 | T021, T034, T054, T060, T062, T072, T102, T103, T107 | 8 | AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-031 | con `refreshConsent=true`, apertura/reanudación aplica cache determinística: `fresh <6h` sin re… | COMP-SEC-GATEWAY | AC-004, AC-065 | T054, T055, T056, T059, T060, T062, T090, T091, T100, T102 … (+2) | 10 | AUTH-005, AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-032 | el usuario siempre dispone de **Actualizar fundamentales**, que fuerza una comprobación puntual… | COMP-SEC-GATEWAY | AC-066 | T034, T056, T057, T061, T062, T091, T105, T107 | 6 | AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-033 | cambios de mappings/métricas/reglas invalidan solo dependencias afectadas. | COMP-ORCHESTRATION | AC-059, AC-060, AC-061, AC-062, AC-063, AC-064 | T029, T048, T055, T058, T062, T068 | 6 | AUTH-016 | EXECUTABLE_AND_TESTED |
| FR-034 | IndexedDB publica candidatos mediante una única transacción atómica y compare-and-swap de point… | COMP-STORAGE | AC-056, AC-057 | T021, T072, T073, T074, T077, T079, T080, T102, T103 | 10 | AUTH-017 | EXECUTABLE_AND_TESTED |
| FR-035 | fallo/cancelación deja los pointers previos intactos y no crea huérfanos. | COMP-STORAGE | AC-058, AC-073 | T021, T023, T033, T048, T057, T059, T062, T073, T077, T079 … (+2) | 14 | AUTH-017, AUTH-020 | EXECUTABLE_AND_TESTED |
| FR-036 | antes del borrado total existe exportación/restauración local versionada con preview; borrar pr… | COMP-STORAGE | AC-076 | T075, T076, T077, T078, T079, T080 | 7 | AUTH-017 | EXECUTABLE_AND_TESTED |
| FR-037 | pipeline usa una única matriz de transiciones; toda transición no listada está prohibida. | COMP-ORCHESTRATION | AC-048, AC-072, AC-073 | T016, T017, T023, T033, T048, T057, T084, T096, T100 | 10 | AUTH-015, AUTH-020, AUTH-021 | EXECUTABLE_AND_TESTED |
| FR-038 | states de facts, cobertura, métricas y pipeline son enums separados. | COMP-ORCHESTRATION | AC-048 | T016, T017 | 2 | AUTH-015 | EXECUTABLE_AND_TESTED |
| FR-039 | solo el gateway emite Problem Details; identidad ambigua, cancelación, quality gate y consentim… | COMP-SEC-GATEWAY | AC-002, AC-018, AC-020, AC-046, AC-055, AC-073 … (+2) | T009, T018, T026, T027, T038, T063, T076, T079, T082, T097 | 11 | AUTH-004, AUTH-009, AUTH-018, AUTH-019, AUTH-020, AUTH-026 | EXECUTABLE_AND_TESTED |
| FR-040 | OpenAPI expone exactamente la matriz operación×status×variant; 409 y 422 no forman parte de la … | COMP-SEC-GATEWAY | AC-043, AC-044, AC-045, AC-046, AC-047, AC-082 | T007, T018, T026, T027 | 4 | AUTH-018, AUTH-019 | EXECUTABLE_AND_TESTED |
| FR-041 | cada estado/error preserva y bloquea capabilities explícitas y ofrece recuperación UI alcanzabl… | COMP-UI-A11Y | AC-002, AC-047, AC-048, AC-072, AC-073, AC-074 … (+1) | T004, T009, T017, T022, T025, T034, T049, T050, T051, T052 … (+14) | 24 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | EXECUTABLE_AND_TESTED |
| FR-042 | cambios de estado, errores, limitaciones y confirmaciones destructivas cumplen los oráculos apl… | COMP-UI-A11Y | AC-067, AC-068, AC-069, AC-070, AC-071, AC-072 … (+2) | T004, T006, T022, T034, T049, T050, T051, T052, T061, T069 … (+11) | 23 | AUTH-019, AUTH-021 | EXECUTABLE_AND_TESTED |
| NFR-001 | mismos inputs/versiones producen mismos outputs/fingerprints. | COMP-ANALYTICS | AC-008, AC-012, AC-013, AC-014, AC-015, AC-019 … (+30) | T002, T005, T011, T013, T014, T016, T023, T032, T036, T038 … (+16) | 26 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012, AUTH-014, AUTH-016, AUTH-026 | EXECUTABLE_AND_TESTED |
| NFR-002 | datos personales permanecen locales salvo requests SEC explícitos. | COMP-STORAGE | AC-053, AC-054, AC-055, AC-056, AC-065, AC-076 | T019, T021, T054, T063, T065, T072, T073, T074, T075, T076 … (+6) | 17 | AUTH-009, AUTH-016, AUTH-017, AUTH-022 | EXECUTABLE_AND_TESTED |
| NFR-003 | User-Agent/contacto obligatorios, concurrencia 1, máximo 14 llamadas por operación, 3 intentos … | COMP-SEC-GATEWAY | AC-003, AC-004, AC-005, AC-006, AC-007, AC-009 … (+4) | T007, T019, T026, T028, T030, T031, T032, T035, T054, T056 … (+9) | 18 | AUTH-005, AUTH-016, AUTH-022 | EXECUTABLE_AND_TESTED |
| NFR-004 | el último snapshot válido permanece utilizable ante fallos. | COMP-STORAGE | AC-002, AC-010, AC-057, AC-058, AC-072, AC-073 … (+2) | T021, T023, T029, T033, T048, T057, T059, T062, T073, T075 … (+13) | 24 | AUTH-005, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | EXECUTABLE_AND_TESTED |
| NFR-005 | JSON, schemas, OpenAPI, referencias, fixtures y crosswalk son validables sin código de producto. | COMP-GOVERNANCE | AC-028, AC-029, AC-033, AC-034, AC-039, AC-042 … (+9) | T001, T002, T003, T005, T006, T008, T010, T012, T015, T017 … (+23) | 35 | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019, AUTH-024, AUTH-025, AUTH-034 | EXECUTABLE_AND_TESTED |
| NFR-006 | cada dominio tiene autoridad primaria y consumidores bidireccionales. | COMP-GOVERNANCE | AC-001, AC-011, AC-016, AC-077, AC-080, AC-083 … (+1) | T001, T008, T010, T012, T015, T024, T047, T098, T101, T107 … (+2) | 10 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-024, AUTH-025, AUTH-034 | EXECUTABLE_AND_TESTED |
| NFR-007 | WCAG 2.2 AA es requisito verificable según 21 oráculos release-blocking; reduced motion se trat… | COMP-UI-A11Y | AC-067, AC-068, AC-069, AC-070, AC-071, AC-072 … (+3) | T004, T006, T022, T083, T084, T085, T086, T087, T088, T104 | 11 | AUTH-019, AUTH-020, AUTH-021 | EXECUTABLE_AND_TESTED |

## AC → requisito → autoridad/fixture → tarea → prueba

| AC | Requisitos | Autoridad | Fixture | Tareas | Pruebas | Estado |
|---|---|---|---|---|---:|---|
| AC-001 | FR-001, NFR-006 | AUTH-003 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-001` | T024, T025, T049, T053, T103 | 5 | EXECUTABLE_AND_TESTED |
| AC-002 | FR-002, FR-039, FR-041, NFR-004 | AUTH-020 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-002` | T018, T024, T025, T082 | 4 | EXECUTABLE_AND_TESTED |
| AC-003 | FR-001, FR-003, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-003` | T026, T028, T030, T035, T092, T095, T097 | 10 | EXECUTABLE_AND_TESTED |
| AC-004 | FR-031, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-004` | T030, T054, T055, T056, T060, T062, T090, T102, T105 | 8 | EXECUTABLE_AND_TESTED |
| AC-005 | FR-004, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-005` | T028, T030, T032, T035, T053 | 7 | EXECUTABLE_AND_TESTED |
| AC-006 | FR-004, FR-008, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-006` | T031, T035, T049 | 4 | EXECUTABLE_AND_TESTED |
| AC-007 | FR-005, FR-007, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-007` | T028, T032, T035 | 5 | EXECUTABLE_AND_TESTED |
| AC-008 | FR-006, NFR-001 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-008` | T028, T032, T035 | 5 | EXECUTABLE_AND_TESTED |
| AC-009 | FR-003, FR-007, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-009` | T028, T032, T033, T035, T056, T092, T095, T105 | 10 | EXECUTABLE_AND_TESTED |
| AC-010 | FR-007, FR-009, FR-010, NFR-004 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-010` | T033, T047, T048, T059 | 4 | EXECUTABLE_AND_TESTED |
| AC-011 | FR-008, FR-010, FR-020, NFR-006 | AUTH-007 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-011` | T020, T031, T047, T049, T050, T053, T103, T106 | 7 | EXECUTABLE_AND_TESTED |
| AC-012 | FR-008, FR-011, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-012` | T036, T050 | 2 | EXECUTABLE_AND_TESTED |
| AC-013 | FR-006, FR-011, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-013` | T036, T050 | 2 | EXECUTABLE_AND_TESTED |
| AC-014 | FR-009, FR-011, NFR-001 | AUTH-008 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-014` | T036, T047, T050, T106 | 3 | EXECUTABLE_AND_TESTED |
| AC-015 | FR-008, FR-014, NFR-001 | AUTH-003 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-015` | T039, T051 | 2 | EXECUTABLE_AND_TESTED |
| AC-016 | FR-011, FR-013, NFR-006 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-016` | T037, T039, T042, T051 | 4 | EXECUTABLE_AND_TESTED |
| AC-017 | FR-011, FR-012, FR-013 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-017` | T037, T042, T051 | 3 | EXECUTABLE_AND_TESTED |
| AC-018 | FR-011, FR-012, FR-039 | AUTH-004 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-018` | T037, T047 | 2 | EXECUTABLE_AND_TESTED |
| AC-019 | FR-008, FR-025, NFR-001 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-019` | T011, T038, T041, T050, T100 | 5 | EXECUTABLE_AND_TESTED |
| AC-020 | FR-008, FR-009, FR-039, NFR-001 | AUTH-026 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-020` | T011, T038, T050, T097 | 4 | EXECUTABLE_AND_TESTED |
| AC-021 | FR-015, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-021` | T040 | 1 | EXECUTABLE_AND_TESTED |
| AC-022 | FR-015, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-022` | T040 | 1 | EXECUTABLE_AND_TESTED |
| AC-023 | FR-015, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-023` | T040 | 1 | EXECUTABLE_AND_TESTED |
| AC-024 | FR-015, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-024` | T040 | 1 | EXECUTABLE_AND_TESTED |
| AC-025 | FR-015, FR-019, NFR-001 | AUTH-011 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-025` | T040, T042, T051 | 3 | EXECUTABLE_AND_TESTED |
| AC-026 | FR-014, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-026` | T011, T041, T042 | 3 | EXECUTABLE_AND_TESTED |
| AC-027 | FR-014, FR-019, NFR-001 | AUTH-006 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-027` | T011, T041, T042 | 3 | EXECUTABLE_AND_TESTED |
| AC-028 | FR-013, FR-014, NFR-005 | AUTH-011 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-028` | T012, T015, T041, T042, T051, T053, T067, T100, T101, T103, T106 | 11 | EXECUTABLE_AND_TESTED |
| AC-029 | FR-016, NFR-001, NFR-005 | AUTH-008 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-029` | T043, T042, T051, T100, T106 | 4 | EXECUTABLE_AND_TESTED |
| AC-030 | FR-016, FR-019, NFR-001 | AUTH-008 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-030` | T043, T051 | 2 | EXECUTABLE_AND_TESTED |
| AC-031 | FR-016, NFR-001 | AUTH-008 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-031` | T043, T051 | 2 | EXECUTABLE_AND_TESTED |
| AC-032 | FR-016, NFR-001 | AUTH-008 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-032` | T043, T051 | 2 | EXECUTABLE_AND_TESTED |
| AC-033 | FR-017, NFR-005 | AUTH-013 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-033` | T012, T044, T052, T100 | 4 | EXECUTABLE_AND_TESTED |
| AC-034 | FR-017, FR-018, NFR-005 | AUTH-012 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-034` | T015, T044, T052, T101 | 5 | EXECUTABLE_AND_TESTED |
| AC-035 | FR-017, FR-019, NFR-001 | AUTH-012 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-035` | T044, T045, T052, T053, T106 | 4 | EXECUTABLE_AND_TESTED |
| AC-036 | FR-017, NFR-001 | AUTH-012 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-036` | T045, T052, T089 | 3 | EXECUTABLE_AND_TESTED |
| AC-037 | FR-020, FR-023, FR-028, NFR-001 | AUTH-012 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-037` | T046, T052, T068 | 3 | EXECUTABLE_AND_TESTED |
| AC-038 | FR-027, FR-028, NFR-001 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-038` | T046 | 1 | EXECUTABLE_AND_TESTED |
| AC-039 | FR-025, FR-029, NFR-001, NFR-005 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-039` | T002, T005, T013, T046, T053, T100 | 6 | EXECUTABLE_AND_TESTED |
| AC-040 | FR-025, FR-029, NFR-001 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-040` | T005, T013, T046 | 3 | EXECUTABLE_AND_TESTED |
| AC-041 | FR-025, FR-027, NFR-001 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-041` | T013, T046 | 2 | EXECUTABLE_AND_TESTED |
| AC-042 | FR-026, NFR-001, NFR-005 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-042` | T015, T020, T046 | 3 | EXECUTABLE_AND_TESTED |
| AC-043 | FR-040, NFR-005 | AUTH-018 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-043` | T007, T012, T026, T027, T101 | 6 | EXECUTABLE_AND_TESTED |
| AC-044 | FR-040, NFR-005 | AUTH-018 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-044` | T027, T101 | 3 | EXECUTABLE_AND_TESTED |
| AC-045 | FR-040, NFR-005 | AUTH-018 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-045` | T012, T027, T101 | 4 | EXECUTABLE_AND_TESTED |
| AC-046 | FR-039, FR-040, NFR-005 | AUTH-018 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-046` | T009, T018, T027, T097 | 4 | EXECUTABLE_AND_TESTED |
| AC-047 | FR-040, FR-041 | AUTH-019 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-047` | T009, T018, T027, T082, T090, T091 | 6 | EXECUTABLE_AND_TESTED |
| AC-048 | FR-037, FR-038, FR-041, NFR-005 | AUTH-015 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-048` | T016, T017, T082, T100 | 4 | EXECUTABLE_AND_TESTED |
| AC-049 | FR-020, FR-021, FR-023 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-049` | T020, T047, T066, T068, T070, T071, T074, T078, T103, T107 | 9 | EXECUTABLE_AND_TESTED |
| AC-050 | FR-021, FR-023 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-050` | T065, T066, T067, T070, T071 | 5 | EXECUTABLE_AND_TESTED |
| AC-051 | FR-023, FR-024 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-051` | T067, T070, T071, T106 | 3 | EXECUTABLE_AND_TESTED |
| AC-052 | FR-023 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-052` | T067, T070, T071, T089 | 4 | EXECUTABLE_AND_TESTED |
| AC-053 | NFR-002, NFR-003 | AUTH-022 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-053` | T019, T028, T066, T097, T107, T108 | 7 | EXECUTABLE_AND_TESTED |
| AC-054 | FR-021, FR-022, NFR-002 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-054` | T063, T064, T065, T069, T096, T103 | 8 | EXECUTABLE_AND_TESTED |
| AC-055 | FR-021, FR-022, FR-039, NFR-002 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-055` | T063, T064, T065, T069, T097 | 6 | EXECUTABLE_AND_TESTED |
| AC-056 | FR-034, NFR-002 | AUTH-017 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-056` | T021, T072, T080 | 4 | EXECUTABLE_AND_TESTED |
| AC-057 | FR-034, NFR-004 | AUTH-017 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-057` | T021, T073, T074, T077, T079, T080, T096, T102, T103 | 12 | EXECUTABLE_AND_TESTED |
| AC-058 | FR-035, NFR-004 | AUTH-017 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-058` | T021, T059, T062, T073, T077, T079, T080, T091, T099, T102, T105 | 11 | EXECUTABLE_AND_TESTED |
| AC-059 | FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-059` | T029, T048, T055, T058, T062 | 5 | EXECUTABLE_AND_TESTED |
| AC-060 | FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-060` | T048, T058, T062 | 3 | EXECUTABLE_AND_TESTED |
| AC-061 | FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-061` | T029, T048, T055, T058, T062 | 5 | EXECUTABLE_AND_TESTED |
| AC-062 | FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-062` | T048, T058, T062 | 3 | EXECUTABLE_AND_TESTED |
| AC-063 | FR-021, FR-022, FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-063` | T058, T066, T068, T071, T074 | 5 | EXECUTABLE_AND_TESTED |
| AC-064 | FR-024, FR-033, NFR-001 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-064` | T014, T058 | 2 | EXECUTABLE_AND_TESTED |
| AC-065 | FR-030, FR-031, NFR-002, NFR-003 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-065` | T021, T034, T054, T059, T060, T062, T072, T090, T091, T099, T100, T102 … (+3) | 12 | EXECUTABLE_AND_TESTED |
| AC-066 | FR-032, NFR-003 | AUTH-016 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-066` | T034, T056, T057, T061, T062, T091, T105, T107 | 6 | EXECUTABLE_AND_TESTED |
| AC-067 | FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-067` | T004, T006, T022, T069, T070, T083, T085, T087, T088, T103, T104 | 12 | EXECUTABLE_AND_TESTED |
| AC-068 | FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-068` | T006, T022, T069, T080, T083, T087, T088, T104 | 10 | EXECUTABLE_AND_TESTED |
| AC-069 | FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-069` | T004, T006, T022, T069, T070, T080, T085, T086, T087, T088, T104 | 13 | EXECUTABLE_AND_TESTED |
| AC-070 | FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-070` | T004, T006, T022, T034, T061, T069, T080, T084, T086, T087, T088, T104 | 14 | EXECUTABLE_AND_TESTED |
| AC-071 | FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-071` | T006, T017, T022, T034, T061, T084, T086, T087, T088, T104 | 11 | EXECUTABLE_AND_TESTED |
| AC-072 | FR-037, FR-041, FR-042, NFR-004, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-072` | T016, T017, T023, T034, T057, T060, T061, T062, T084, T087, T088, T096 … (+2) | 15 | EXECUTABLE_AND_TESTED |
| AC-073 | FR-035, FR-037, FR-039, FR-041, NFR-004, NFR-007 | AUTH-020 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-073` | T016, T017, T023, T033, T034, T048, T057, T059, T061, T062, T073, T079 … (+7) | 20 | EXECUTABLE_AND_TESTED |
| AC-074 | FR-041, FR-042, NFR-007 | AUTH-021 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-074` | T025, T049, T050, T051, T052, T070, T081, T089, T085, T086, T087, T088 … (+2) | 13 | EXECUTABLE_AND_TESTED |
| AC-075 | FR-039, FR-041, FR-042, NFR-004, NFR-007 | AUTH-019 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-075` | T017, T025, T034, T059, T061, T076, T079, T080, T082, T086, T087, T088 … (+5) | 17 | EXECUTABLE_AND_TESTED |
| AC-076 | FR-036, NFR-002, NFR-004 | AUTH-017 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-076` | T019, T021, T072, T075, T076, T077, T078, T079, T080, T097 | 11 | EXECUTABLE_AND_TESTED |
| AC-077 | NFR-005, NFR-006 | AUTH-025 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-077` | T001, T003, T008, T010, T090, T093, T094, T098, T099, T101, T105, T108 … (+1) | 10 | EXECUTABLE_AND_TESTED |
| AC-078 | FR-020, FR-022, FR-026, FR-028, NFR-001 | AUTH-014 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-078` | T020, T046, T066, T068, T071, T074 | 6 | EXECUTABLE_AND_TESTED |
| AC-079 | FR-024, FR-027, NFR-001 | AUTH-009 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-079` | T014, T046, T066, T071 | 4 | EXECUTABLE_AND_TESTED |
| AC-080 | FR-011, NFR-001, NFR-006 | AUTH-004 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-080` | T036, T037 | 2 | EXECUTABLE_AND_TESTED |
| AC-081 | FR-003, FR-004, FR-005, FR-006, FR-007, NFR-001, NFR-003 | AUTH-005 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-081` | T007, T028, T030, T032, T035, T056, T092, T095, T101, T102, T105 | 13 | EXECUTABLE_AND_TESTED |
| AC-082 | FR-039, FR-040, NFR-005 | AUTH-019 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-082` | T007, T018, T026, T027, T035, T101 | 8 | EXECUTABLE_AND_TESTED |
| AC-083 | NFR-005, NFR-006 | AUTH-034 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-083` | T001, T002, T003, T005, T008, T010, T012, T015, T029, T093, T094, T098 … (+4) | 14 | EXECUTABLE_AND_TESTED |
| AC-084 | NFR-005, NFR-006 | AUTH-024 | `fixtures/acceptance/core-scenarios.json#/scenarios/AC-084` | T001, T010, T015, T098, T101, T107, T108, T109 | 6 | EXECUTABLE_AND_TESTED |

## Inventario de tareas

| Tarea | Fase | US | [P] | Dependencias | Refs | Autoridad | Archivos / pruebas | Estado |
|---|---|---|---:|---|---|---|---|---|
| T001 | Phase 1 — Setup | — | No | — | NFR-005, NFR-006, AC-077, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 3 / 1 | EXECUTABLE |
| T002 | Phase 1 — Setup | — | Sí | — | NFR-001, NFR-005, AC-039, AC-083 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 3 / 1 | EXECUTABLE |
| T003 | Phase 1 — Setup | — | Sí | — | NFR-005, AC-077, AC-083 | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+3) | 4 / 1 | EXECUTABLE |
| T004 | Phase 1 — Setup | — | No | T003 | FR-041, FR-042, NFR-007, AC-067, AC-069, AC-070 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 4 / 1 | EXECUTABLE |
| T005 | Phase 1 — Setup | — | Sí | — | NFR-001, NFR-005, AC-039, AC-040, AC-083 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 2 / 1 | EXECUTABLE |
| T006 | Phase 1 — Setup | — | Sí | — | FR-042, NFR-005, NFR-007, AC-067, AC-068, AC-069, AC-070, AC-071 | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+5) | 3 / 2 | EXECUTABLE |
| T007 | Phase 1 — Setup | — | Sí | — | FR-003, FR-040, NFR-003, AC-043, AC-081, AC-082 | AUTH-005, AUTH-016, AUTH-018, AUTH-019, AUTH-022 | 3 / 1 | EXECUTABLE |
| T008 | Phase 1 — Setup | — | No | T007 | NFR-005, NFR-006, AC-077, AC-083 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 2 / 1 | EXECUTABLE |
| T009 | Phase 1 — Setup | — | Sí | — | FR-039, FR-041, AC-046, AC-047 | AUTH-004, AUTH-009, AUTH-015, AUTH-018, AUTH-019, AUTH-020, AUTH-021, AUTH-026 | 3 / 1 | EXECUTABLE |
| T010 | Phase 1 — Setup | — | Sí | — | NFR-005, NFR-006, AC-077, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 1 / 0 | EXECUTABLE |
| T011 | Phase 2 — Foundational | — | No | T001, T002, T005 | FR-008, FR-014, NFR-001, AC-019, AC-020, AC-026, AC-027 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+4) | 2 / 1 | EXECUTABLE |
| T012 | Phase 2 — Foundational | — | Sí | T001, T002, T005 | NFR-005, NFR-006, AC-028, AC-033, AC-043, AC-045, AC-083 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 3 / 1 | EXECUTABLE |
| T013 | Phase 2 — Foundational | — | Sí | T002, T005 | FR-025, FR-029, NFR-001, AC-039, AC-040, AC-041 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 3 / 1 | EXECUTABLE |
| T014 | Phase 2 — Foundational | — | Sí | T002, T005 | FR-024, FR-027, NFR-001, AC-064, AC-079 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 3 / 1 | EXECUTABLE |
| T015 | Phase 2 — Foundational | — | No | T012 | NFR-005, NFR-006, AC-028, AC-034, AC-042, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 3 / 1 | EXECUTABLE |
| T016 | Phase 2 — Foundational | — | Sí | T002, T012 | FR-037, FR-038, NFR-001, AC-048, AC-072, AC-073 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+6) | 2 / 1 | EXECUTABLE |
| T017 | Phase 2 — Foundational | — | No | T015, T016 | FR-037, FR-038, FR-041, NFR-005, AC-048, AC-071, AC-072, AC-073 … (+1) | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+5) | 3 / 1 | EXECUTABLE |
| T018 | Phase 2 — Foundational | — | Sí | T012 | FR-039, FR-040, NFR-005, AC-002, AC-046, AC-047, AC-082 | AUTH-004, AUTH-008, AUTH-009, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015 … (+7) | 3 / 1 | EXECUTABLE |
| T019 | Phase 2 — Foundational | — | Sí | T002 | NFR-002, NFR-003, AC-053, AC-076 | AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-022 | 3 / 1 | EXECUTABLE |
| T020 | Phase 2 — Foundational | — | No | T011, T012 | FR-008, FR-020, FR-021, FR-026, AC-011, AC-042, AC-049, AC-078 | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-009, AUTH-012, AUTH-014, AUTH-016 … (+1) | 4 / 1 | EXECUTABLE |
| T021 | Phase 2 — Foundational | — | Sí | T002, T012 | FR-030, FR-034, FR-035, NFR-002, NFR-004, AC-056, AC-057, AC-058 … (+2) | AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021, AUTH-022 | 5 / 2 | EXECUTABLE |
| T022 | Phase 2 — Foundational | — | Sí | T004, T006 | FR-041, FR-042, NFR-007, AC-067, AC-068, AC-069, AC-070, AC-071 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 5 / 1 | EXECUTABLE |
| T023 | Phase 2 — Foundational | — | No | T015, T016, T017 | FR-035, FR-037, NFR-001, NFR-004, AC-072, AC-073 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+8) | 3 / 1 | EXECUTABLE |
| T024 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T012, T018, T020 | FR-001, FR-002, NFR-006, AC-001, AC-002 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-020, AUTH-024, AUTH-025 … (+1) | 3 / 1 | EXECUTABLE |
| T025 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T022, T024 | FR-001, FR-002, FR-041, AC-001, AC-002, AC-074, AC-075 | AUTH-003, AUTH-005, AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T026 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | Sí | T007, T009, T018 | FR-003, FR-039, FR-040, NFR-003, AC-003, AC-043, AC-082 | AUTH-004, AUTH-005, AUTH-009, AUTH-016, AUTH-018, AUTH-019, AUTH-020, AUTH-022 … (+1) | 3 / 1 | EXECUTABLE |
| T027 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T018, T026 | FR-039, FR-040, NFR-005, AC-043, AC-044, AC-045, AC-046, AC-047 … (+1) | AUTH-004, AUTH-008, AUTH-009, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015 … (+7) | 4 / 1 | EXECUTABLE |
| T028 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T007, T019, T026, T027 | FR-003, FR-004, FR-005, FR-006, FR-007, NFR-003, AC-003, AC-005 … (+5) | AUTH-005, AUTH-006, AUTH-016, AUTH-022 | 7 / 3 | EXECUTABLE |
| T029 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | Sí | T008, T012 | FR-033, NFR-004, NFR-005, AC-059, AC-061, AC-083 | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+8) | 3 / 1 | EXECUTABLE |
| T030 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T012, T027, T028 | FR-003, FR-004, NFR-003, AC-003, AC-004, AC-005, AC-081 | AUTH-005, AUTH-016, AUTH-022 | 3 / 1 | EXECUTABLE |
| T031 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | Sí | T015, T020 | FR-004, FR-008, NFR-003, AC-006, AC-011 | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-014, AUTH-016, AUTH-022, AUTH-026 | 2 / 1 | EXECUTABLE |
| T032 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T015, T029, T030 | FR-003, FR-004, FR-005, FR-006, FR-007, NFR-001, NFR-003, AC-005 … (+4) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+4) | 3 / 1 | EXECUTABLE |
| T033 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T023, T031 | FR-007, FR-035, FR-037, NFR-004, AC-009, AC-010, AC-073 | AUTH-005, AUTH-015, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T034 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | No | T025, T032, T033 | FR-030, FR-032, FR-041, FR-042, AC-065, AC-066, AC-070, AC-071 … (+3) | AUTH-015, AUTH-016, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T035 | Phase 3 — User Story 1: Resolve issuer and acquire SEC data | US1 | Sí | T012, T027, T028, T031 | FR-003, FR-004, FR-005, FR-006, FR-007, NFR-003, NFR-005, AC-003 … (+7) | AUTH-005, AUTH-006, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015 … (+7) | 2 / 2 | EXECUTABLE |
| T036 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T015, T020, T030 | FR-006, FR-011, NFR-001, AC-012, AC-013, AC-014, AC-080 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T037 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T015, T020 | FR-011, FR-012, FR-013, AC-016, AC-017, AC-018, AC-080 | AUTH-004, AUTH-006, AUTH-008, AUTH-011 | 2 / 1 | EXECUTABLE |
| T038 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T011, T018, T020 | FR-008, FR-009, FR-039, NFR-001, AC-019, AC-020 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+7) | 2 / 1 | EXECUTABLE |
| T039 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T036, T038 | FR-008, FR-014, NFR-001, AC-015, AC-016 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+4) | 2 / 1 | EXECUTABLE |
| T040 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T035, T037 | FR-015, FR-019, NFR-001, AC-021, AC-022, AC-023, AC-024, AC-025 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T041 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T011, T012, T015 | FR-013, FR-014, NFR-001, NFR-005, AC-019, AC-026, AC-027, AC-028 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 2 / 1 | EXECUTABLE |
| T043 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T012, T015 | FR-016, FR-019, NFR-001, NFR-005, AC-029, AC-030, AC-031, AC-032 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 2 / 1 | EXECUTABLE |
| T042 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T039, T040, T041, T043 | FR-013, FR-014, FR-015, FR-016, FR-019, NFR-001, AC-016, AC-017 … (+5) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T044 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T012, T041, T042 | FR-017, FR-018, FR-019, NFR-001, NFR-005, AC-033, AC-034, AC-035 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 2 / 1 | EXECUTABLE |
| T045 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T043, T044 | FR-017, FR-019, NFR-001, AC-035, AC-036 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+4) | 2 / 1 | EXECUTABLE |
| T046 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T013, T014, T015, T020 | FR-025, FR-026, FR-027, FR-028, FR-029, NFR-001, NFR-005, AC-037 … (+7) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+10) | 3 / 1 | EXECUTABLE |
| T047 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T035, T036, T037, T038, T041, T042, T043, T044, T045 | FR-008, FR-009, FR-010, FR-020, NFR-006, AC-010, AC-011, AC-014 … (+2) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-012 … (+5) | 3 / 1 | EXECUTABLE |
| T048 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T023, T033, T046, T047 | FR-007, FR-033, FR-035, FR-037, NFR-001, NFR-004, AC-010, AC-059 … (+4) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+8) | 2 / 1 | EXECUTABLE |
| T049 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T022, T030 | FR-001, FR-008, FR-041, FR-042, AC-001, AC-006, AC-011, AC-074 | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-014, AUTH-015, AUTH-019, AUTH-020 … (+2) | 3 / 1 | EXECUTABLE |
| T050 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | Sí | T037, T046 | FR-008, FR-009, FR-010, FR-041, FR-042, AC-011, AC-012, AC-013 … (+4) | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-014, AUTH-015, AUTH-019 … (+3) | 3 / 1 | EXECUTABLE |
| T051 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T041, T042, T046 | FR-013, FR-014, FR-016, FR-041, FR-042, AC-015, AC-016, AC-017 … (+7) | AUTH-003, AUTH-006, AUTH-008, AUTH-011, AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T052 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T043, T044, T045, T046 | FR-017, FR-018, FR-019, FR-041, FR-042, AC-033, AC-034, AC-035 … (+3) | AUTH-006, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-015, AUTH-019, AUTH-020 … (+1) | 3 / 1 | EXECUTABLE |
| T053 | Phase 4 — User Story 2: Analyze fundamentals with evidence | US2 | No | T034, T047, T048, T049, T050, T051, T052 | FR-001, FR-003, FR-008, FR-013, FR-017, FR-025, NFR-001, AC-001 … (+5) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+5) | 1 / 1 | EXECUTABLE |
| T054 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T014, T015, T017 | FR-030, FR-031, NFR-002, NFR-003, AC-004, AC-065 | AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-022 | 2 / 1 | EXECUTABLE |
| T055 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | Sí | T013, T030 | FR-031, FR-033, NFR-001, AC-004, AC-059, AC-061 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T056 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | Sí | T014, T029 | FR-003, FR-031, FR-032, NFR-003, AC-004, AC-009, AC-066, AC-081 | AUTH-005, AUTH-016, AUTH-022 | 3 / 1 | EXECUTABLE |
| T057 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T023, T032 | FR-032, FR-035, FR-037, NFR-004, AC-066, AC-072, AC-073 | AUTH-005, AUTH-015, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T058 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T015, T041, T043, T045 | FR-033, NFR-001, AC-059, AC-060, AC-061, AC-062, AC-063, AC-064 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T059 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T017, T047, T054, T056 | FR-007, FR-031, FR-035, NFR-004, AC-010, AC-058, AC-065, AC-073 … (+1) | AUTH-005, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T060 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T021, T053, T054, T055, T056, T057, T059 | FR-030, FR-031, FR-041, AC-004, AC-065, AC-072 | AUTH-005, AUTH-015, AUTH-016, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T061 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T021, T022, T053, T055, T056, T057, T059 | FR-032, FR-041, FR-042, AC-066, AC-070, AC-071, AC-072, AC-073 … (+1) | AUTH-015, AUTH-016, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T062 | Phase 5 — User Story 3: Refresh and reanalyze safely | US3 | No | T053, T054, T055, T056, T057, T058, T059, T060, T061 | FR-030, FR-031, FR-032, FR-033, FR-035, NFR-003, NFR-004, AC-004 … (+9) | AUTH-005, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021, AUTH-022 | 1 / 1 | EXECUTABLE |
| T063 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T012, T018, T023 | FR-021, FR-022, FR-039, NFR-002, AC-054, AC-055 | AUTH-004, AUTH-009, AUTH-014, AUTH-016, AUTH-017, AUTH-018, AUTH-019, AUTH-020 … (+2) | 3 / 2 | EXECUTABLE |
| T064 | Phase 6 — User Story 4: Manage optional historical price | US4 | Sí | T012, T020 | FR-021, FR-022, AC-054, AC-055 | AUTH-009, AUTH-014, AUTH-016 | 2 / 1 | EXECUTABLE |
| T065 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T063, T064 | FR-021, FR-022, NFR-002, AC-050, AC-054, AC-055 | AUTH-009, AUTH-014, AUTH-016, AUTH-017, AUTH-022 | 2 / 1 | EXECUTABLE |
| T066 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T014, T020, T046, T065 | FR-020, FR-021, FR-022, FR-024, FR-026, FR-028, NFR-001, AC-049 … (+5) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+5) | 2 / 1 | EXECUTABLE |
| T067 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T041, T043, T066 | FR-013, FR-016, FR-023, NFR-001, AC-028, AC-050, AC-051, AC-052 | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T068 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T066, T067 | FR-021, FR-022, FR-023, FR-033, NFR-001, AC-037, AC-049, AC-063 … (+1) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+3) | 2 / 1 | EXECUTABLE |
| T069 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T022, T065, T068 | FR-021, FR-022, FR-041, FR-042, AC-054, AC-055, AC-067, AC-068 … (+2) | AUTH-009, AUTH-014, AUTH-015, AUTH-016, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T070 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T022, T067, T068 | FR-023, FR-024, FR-041, FR-042, AC-049, AC-050, AC-051, AC-052 … (+3) | AUTH-009, AUTH-012, AUTH-015, AUTH-016, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T071 | Phase 6 — User Story 4: Manage optional historical price | US4 | No | T063, T064, T065, T066, T067, T068, T069, T070 | FR-020, FR-021, FR-022, FR-023, FR-024, AC-049, AC-050, AC-051 … (+4) | AUTH-007, AUTH-009, AUTH-012, AUTH-014, AUTH-016 | 1 / 1 | EXECUTABLE |
| T072 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T021, T022 | FR-030, FR-034, NFR-002, AC-056, AC-065, AC-076 | AUTH-009, AUTH-016, AUTH-017, AUTH-022 | 2 / 1 | EXECUTABLE |
| T073 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T021, T046 | FR-034, FR-035, NFR-002, NFR-004, AC-057, AC-058, AC-073 | AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021, AUTH-022 | 2 / 1 | EXECUTABLE |
| T074 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | Sí | T021, T066, T068 | FR-021, FR-022, FR-034, NFR-002, AC-049, AC-057, AC-063, AC-078 | AUTH-009, AUTH-014, AUTH-016, AUTH-017, AUTH-022 | 2 / 1 | EXECUTABLE |
| T075 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T013, T073, T074 | FR-036, NFR-002, NFR-004, AC-076 | AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021, AUTH-022 | 2 / 1 | EXECUTABLE |
| T076 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | Sí | T012, T018, T073, T074, T075 | FR-036, FR-039, NFR-002, NFR-004, AC-075, AC-076 | AUTH-004, AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-018, AUTH-019, AUTH-020 … (+3) | 2 / 1 | EXECUTABLE |
| T077 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T021, T073, T074, T076 | FR-034, FR-035, FR-036, NFR-004, AC-057, AC-058, AC-076 | AUTH-005, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T078 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T073, T074, T075 | FR-022, FR-036, NFR-002, NFR-004, AC-049, AC-076 | AUTH-005, AUTH-009, AUTH-014, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021 … (+1) | 2 / 1 | EXECUTABLE |
| T079 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T073, T074 | FR-034, FR-035, FR-036, FR-039, NFR-002, NFR-004, AC-057, AC-058 … (+3) | AUTH-004, AUTH-005, AUTH-009, AUTH-016, AUTH-017, AUTH-018, AUTH-019, AUTH-020 … (+3) | 4 / 1 | EXECUTABLE |
| T080 | Phase 7 — User Story 5: Persist, export, restore and delete local data | US5 | No | T022, T072, T073, T074, T075, T076, T077, T078, T079 | FR-034, FR-035, FR-036, FR-041, FR-042, NFR-002, NFR-004, AC-056 … (+8) | AUTH-005, AUTH-009, AUTH-015, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021 … (+1) | 4 / 2 | EXECUTABLE |
| T081 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T004, T047 | FR-041, FR-042, AC-074 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T082 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T017, T018, T022, T079 | FR-039, FR-041, NFR-004, AC-002, AC-047, AC-048, AC-075 | AUTH-004, AUTH-005, AUTH-009, AUTH-015, AUTH-017, AUTH-018, AUTH-019, AUTH-020 … (+2) | 3 / 1 | EXECUTABLE |
| T089 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T050, T067 | FR-017, FR-023, FR-041, AC-036, AC-052, AC-074 | AUTH-009, AUTH-012, AUTH-013, AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T083 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | Sí | T022 | FR-042, NFR-007, AC-067, AC-068, AC-073 | AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T084 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | Sí | T017, T022 | FR-037, FR-041, FR-042, NFR-007, AC-070, AC-071, AC-072, AC-073 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 2 / 1 | EXECUTABLE |
| T085 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | Sí | T004 | FR-042, NFR-007, AC-067, AC-069, AC-074 | AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T086 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T025, T034, T049, T050, T051, T052, T061, T069, T070, T072, T080, T082 | FR-041, FR-042, NFR-007, AC-069, AC-070, AC-071, AC-074, AC-075 | AUTH-015, AUTH-019, AUTH-020, AUTH-021 | 12 / 1 | EXECUTABLE |
| T087 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T006, T053, T062, T071, T080, T081, T082, T083, T084, T085, T086, T089 | FR-042, NFR-005, NFR-007, AC-067, AC-068, AC-069, AC-070, AC-071 … (+4) | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+5) | 2 / 2 | EXECUTABLE |
| T088 | Phase 8 — User Story 6: Operate accessibly and recover from failures | US6 | No | T053, T062, T071, T080, T081, T082, T083, T084, T085, T086, T087, T089 | FR-042, NFR-005, NFR-007, AC-067, AC-068, AC-069, AC-070, AC-071 … (+4) | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+5) | 2 / 1 | EXECUTABLE |
| T090 | Phase 9 — Cloudflare Free, security and observability | — | No | T007, T012, T056 | FR-031, FR-041, NFR-003, NFR-004, NFR-005, AC-004, AC-047, AC-065 … (+2) | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+9) | 2 / 1 | EXECUTABLE |
| T091 | Phase 9 — Cloudflare Free, security and observability | — | No | T018, T030, T059, T090 | FR-031, FR-032, FR-041, NFR-004, AC-047, AC-058, AC-065, AC-066 … (+1) | AUTH-005, AUTH-015, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021 | 3 / 1 | EXECUTABLE |
| T092 | Phase 9 — Cloudflare Free, security and observability | — | Sí | T019, T027, T028 | NFR-003, NFR-005, AC-003, AC-009, AC-081 | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+6) | 2 / 1 | EXECUTABLE |
| T093 | Phase 9 — Cloudflare Free, security and observability | — | Sí | T008, T029 | NFR-004, NFR-005, AC-077, AC-083 | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-017 … (+7) | 2 / 1 | EXECUTABLE |
| T094 | Phase 9 — Cloudflare Free, security and observability | — | Sí | T003, T007 | NFR-005, AC-077, AC-083 | AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-018, AUTH-019 … (+3) | 2 / 1 | EXECUTABLE |
| T095 | Phase 9 — Cloudflare Free, security and observability | — | No | T028, T030, T092 | FR-003, NFR-003, NFR-005, AC-003, AC-009, AC-081 | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+6) | 2 / 2 | EXECUTABLE |
| T096 | Phase 9 — Cloudflare Free, security and observability | — | Sí | T048, T060, T063, T067, T073, T074, T077, T078, T079, T080 | FR-021, FR-037, NFR-004, NFR-005, AC-054, AC-057, AC-072 | AUTH-005, AUTH-008, AUTH-009, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015 … (+9) | 2 / 2 | EXECUTABLE |
| T097 | Phase 9 — Cloudflare Free, security and observability | — | No | T009, T012, T018 | FR-039, NFR-002, NFR-003, NFR-005, AC-003, AC-020, AC-046, AC-053 … (+2) | AUTH-004, AUTH-005, AUTH-008, AUTH-009, AUTH-011, AUTH-012, AUTH-013, AUTH-014 … (+11) | 4 / 1 | EXECUTABLE |
| T098 | Phase 9 — Cloudflare Free, security and observability | — | No | T001 | NFR-005, NFR-006, AC-077, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 3 / 1 | EXECUTABLE |
| T099 | Phase 9 — Cloudflare Free, security and observability | — | Sí | T090, T091, T092, T093, T094, T095, T096, T097, T098 | NFR-003, NFR-004, NFR-005, AC-058, AC-065, AC-075, AC-077 | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+9) | 2 / 0 | EXECUTABLE |
| T100 | Phase 10 — Validation and documentation | — | No | T011, T013, T014, T017, T040, T041, T042, T043, T044, T045, T046, T054 … (+9) | FR-008, FR-013, FR-014, FR-016, FR-017, FR-025, FR-031, FR-037 … (+8) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011 … (+8) | 1 / 1 | EXECUTABLE |
| T101 | Phase 10 — Validation and documentation | — | No | T007, T009, T012, T015, T018, T026, T027, T028, T035, T090, T094, T097 … (+1) | NFR-005, NFR-006, AC-028, AC-034, AC-043, AC-044, AC-045, AC-077 … (+4) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012 … (+8) | 2 / 2 | EXECUTABLE |
| T102 | Phase 10 — Validation and documentation | — | No | T028, T029, T030, T032, T033, T047, T048, T054, T055, T056, T057, T058 … (+14) | FR-003, FR-030, FR-031, FR-034, FR-035, NFR-003, NFR-004, AC-004 … (+6) | AUTH-005, AUTH-016, AUTH-017, AUTH-019, AUTH-020, AUTH-021, AUTH-022 | 1 / 1 | EXECUTABLE |
| T103 | Phase 10 — Validation and documentation | — | No | T053, T062, T071, T080, T087, T088, T089 | FR-001, FR-008, FR-013, FR-021, FR-030, FR-034, FR-041, FR-042 … (+9) | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-009, AUTH-011, AUTH-014, AUTH-015 … (+6) | 1 / 1 | EXECUTABLE |
| T104 | Phase 10 — Validation and documentation | — | No | T087, T088 | FR-042, NFR-007, AC-067, AC-068, AC-069, AC-070, AC-071, AC-072 … (+3) | AUTH-019, AUTH-020, AUTH-021 | 1 / 0 | EXECUTABLE |
| T105 | Phase 10 — Validation and documentation | — | No | T090, T091, T092, T093, T094, T095, T096, T097, T098, T099 | FR-031, FR-032, NFR-003, NFR-004, NFR-005, AC-004, AC-009, AC-058 … (+4) | AUTH-005, AUTH-008, AUTH-011, AUTH-012, AUTH-013, AUTH-014, AUTH-015, AUTH-016 … (+9) | 1 / 0 | EXECUTABLE |
| T106 | Phase 10 — Validation and documentation | — | Sí | T048, T049, T050, T051, T052, T067, T070, T089 | FR-008, FR-010, FR-013, FR-016, FR-017, FR-023, FR-041, AC-011 … (+6) | AUTH-003, AUTH-005, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+7) | 2 / 0 | EXECUTABLE |
| T107 | Phase 10 — Validation and documentation | — | Sí | T060, T061, T068, T073, T074, T075, T076, T077, T078, T079, T080, T099 … (+2) | FR-020, FR-030, FR-031, FR-032, NFR-002, NFR-003, NFR-006, AC-049 … (+5) | AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-007, AUTH-009, AUTH-012, AUTH-014 … (+6) | 4 / 0 | EXECUTABLE |
| T108 | Phase 10 — Validation and documentation | — | No | T094, T095, T096, T097, T098, T105, T107 | NFR-002, NFR-005, NFR-006, AC-053, AC-077, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-009, AUTH-011, AUTH-012 … (+11) | 1 / 1 | EXECUTABLE |
| T109 | Phase 10 — Validation and documentation | — | No | T010, T019, T099, T100, T101, T102, T103, T104, T105, T106, T107, T108 | NFR-005, NFR-006, AC-077, AC-083, AC-084 | AUTH-003, AUTH-004, AUTH-006, AUTH-007, AUTH-008, AUTH-011, AUTH-012, AUTH-013 … (+7) | 1 / 0 | EXECUTABLE |

## Excepciones controladas

- Tareas documentales/evidencia sin ruta `tests/`: T010, T099, T104, T105, T106, T107, T109.
- Ninguna es una tarea de implementación o configuración.
- IDs duplicados, refs inválidas, ciclos, dependencias posteriores, colisiones `[P]` y tareas fuera de T109: cero.
