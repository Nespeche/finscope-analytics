# B08 — Verificación de evidencia y cierre

## Resultado

`PASS`. El baseline `FS_v0.21.8_B07_completed.zip` (`6e87f79be53a913fbf3db602cc50b1fa1fa211663596b126037c4a9b4d55be2e`), el candidato exacto `FS_B08_r2.zip` (`05584b07899a33c9585d3b8c4e33f41986d52be792e65a773f952cf8fc920039`), el runner autenticado `Run-FinScope-BatchValidation_B08_r2_v1.ps1` (`18cf5837ebe62f945a5549def65923ef9896326cab5e096079d113c72c325867`) y la evidencia `FinScope_local_evidence_B08_20260727-204245257.zip` (`5c7fa166241ba1063d6d8722a4d2b0ed7d50e4098129bf07d80b032b91ed4c66`) quedaron vinculados por bytes, hashes y sidecars válidos.

## Evidencia ejecutable

- PowerShell 7.6.4 Core; Node v24.18.0; npm 11.16.0;
- 5 comandos obligatorios: 5 PASS, 0 FAIL, 0 NOT_RUN;
- unidad B08: 5 archivos / 23 tests;
- regresión Vitest: 38 archivos / 158 tests;
- build: 250 módulos y 3 assets, 1.440.018 bytes;
- control plane inicial/final: 1024/1024 PASS;
- schema de evidencia PASS, stdout/stderr separados y autenticados;
- árbol restaurado después de limpiar `node_modules` y `dist`.

## Cierre

T036–T040 se marcan `[X]`; B08 pasa a `COMPLETED`; B09 queda `PENDING` como siguiente lote activo/autorizado; `activeBatchId=B09`; `nextAuthorizedBatchId=B09`; `convergenceAuthorized=false`.

La promoción aplica exclusivamente la allowlist de cierre. No se repitieron npm ni pruebas funcionales porque no cambiaron código, tests, runners, scripts npm, schemas, dependencias, fixtures, contratos, comportamiento ni `.specify` después de la evidencia PASS.

## Control plane post-cierre

El validador se ejecuta sobre el paquete cerrado con los hashes derivados del nuevo `tasks.md`. `.specify` conserva 19 archivos y hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.
