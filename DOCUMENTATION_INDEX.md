# DOCUMENTATION INDEX — FinScope Analytics B20 completed / hardening candidate

<!-- B20_CLOSURE_MECHANISM_STATE_BEGIN -->
**Estado:** `REMEDIATION_CLOSURE_MECHANISM_CANDIDATE — CLOSURE_NOT_AUTHORIZED`

El mecanismo dedicado usa el literal contractual `AUTHORIZE_B20_POST_RESTORE_CLOSURE_COMMIT` junto con un único bloque JSON canónico entre `B20_CLOSURE_BINDING_JSON_BEGIN` y `B20_CLOSURE_BINDING_JSON_END`. El literal está declarado, pero no insertado en el cuerpo del PR. `operation.stage=candidate`; cierre, Ready, merge, tag/Release, sustitución de Fuentes, B21 y convergencia continúan no autorizados.
<!-- B20_CLOSURE_MECHANISM_STATE_END -->

## Entrada obligatoria

1. `START_HERE_CHATGPT.md`;
2. `.specify/memory/constitution.md`;
3. `V0.21_PHASE_STATUS.md`;
4. `implementation-control/AUTHORITY_MATRIX.json`;
5. `implementation-control/IMPLEMENTATION_STATE.json`;
6. `implementation-control/TASK_SOURCE_LOCK.json`;
7. `implementation-control/IMPLEMENTATION_BATCH_MAP.json`;
8. `implementation-control/batches/B20.json`;
9. `implementation-control/batches/B21.json`;
10. `implementation-control/GITHUB_HANDOFF.json`;
11. `implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md`;
12. `implementation-control/GITHUB_VALIDATION_PROTOCOL.md`;
13. `implementation-control/GITHUB_RELEASE_PROTOCOL.md`;
14. `implementation-control/reports/B20_EVIDENCE_VERIFICATION_AND_CLOSURE.md`.

## Gate y estado activo

`tasksAuthorized=true`, `analysisAuthorized=true`, `implementationAuthorized=true`, `convergenceAuthorized=false`.

B01–B20 y T001–T089 están `COMPLETED`. B21 está `PENDING`, con `activeBatchId=B21` y `nextAuthorizedBatchId=B21`, pero permanece no ejecutable mientras `implementation-control/GITHUB_HANDOFF.json` mantenga el hold extraordinario de recuperación de Release.

## Baseline e integridad

Baseline normativo en Fuentes: `FS_v0.21.25_B20_completed.zip`, SHA-256 `c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`; raíz `FinScope_v0.21.4/`; `.specify` contiene 19 archivos y permanece byte-inmutable.

Objetivo inmutable de la remediación: tag `v0.21.25-B20-completed-r4`, ZIP `FS_v0.21.25_B20_completed_r4.zip` y sidecar `FS_v0.21.25_B20_completed_r4.zip.sha256`. Es candidato no promovible hasta completar todos los gates y no altera la pareja activa de Fuentes.

El hash `a906ec783e78a235a2b30a09bd40b061cbbd826479893247e1a76759908db55f` es `REJECTED_NOT_PROMOTABLE` y no constituye baseline ni evidencia PASS.
