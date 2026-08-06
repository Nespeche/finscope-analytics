# START HERE — FinScope Analytics B20 completed / Release recovery hold

<!-- B20_CLOSURE_MECHANISM_STATE_BEGIN -->
**Estado:** `REMEDIATION_CORRECTIVE_CANDIDATE_R5 — CLOSURE_NOT_AUTHORIZED`

El cierre r4 `8e6d2bcbf086dbbef598c5f069753ecb25fd1e88` y el run `31103860816` son `REJECTED_NOT_PROMOTABLE`: el generador retiró documentación que el validador exigía y el workflow produjo errores secundarios sin artifact válido. El mecanismo corregido conserva el literal contractual `AUTHORIZE_B20_POST_RESTORE_CLOSURE_COMMIT` como documentación, pero no está insertado en el cuerpo del PR. `operation.stage=candidate`; cierre, Ready, merge, tag/Release, sustitución de Fuentes, B21 y convergencia continúan no autorizados.
<!-- B20_CLOSURE_MECHANISM_STATE_END -->

La pareja normativa activa en Fuentes continúa siendo `FS_v0.21.25_B20_completed.zip` + `FS_v0.21.25_B20_completed.zip.sha256`, SHA-256 `c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`, raíz `FinScope_v0.21.4/`. Un candidato de esta remediación no reemplaza esa pareja. Los bytes corregidos se califican con identidad independiente `v0.21.25-B20-completed-r5`, ZIP `FS_v0.21.25_B20_completed_r5.zip` y sidecar homónimo; reutilizar la identidad completed anterior está prohibido.

B01–B20 y T001–T089 están `COMPLETED`. B21 permanece `PENDING`: `activeBatchId=B21`, `nextAuthorizedBatchId=B21`, `tasksAuthorized=true`, `analysisAuthorized=true`, `implementationAuthorized=true`, `convergenceAuthorized=false`.

Está activo el gate extraordinario `b20-post-restore-control-plane-hardening`. Aunque los gates ordinarios de análisis e implementación permanecen verdaderos, B21 no es ejecutable durante el hold. Solo se permite la operación especial exacta declarada en `implementation-control/GITHUB_HANDOFF.json`.

El hold se libera únicamente después de autorizaciones independientes de cierre, Ready/merge, tag/Release y sustitución de Fuentes; el Release debe descargarse nuevamente y autenticarse contra sidecar, CRC, raíz, metadata, inventario, manifiesto, `.specify`, control plane y commit/tag.
