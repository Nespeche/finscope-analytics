# B17 — Verificación de evidencia y cierre GitHub-first

## Resultado

`PASS`. Baseline `FS_v0.21.19_B16_completed.zip` (`6553ce27b8c4d21ceab4967628debcba0ffc67c1b736d0d488f3c6fa36881bc0`), candidate `244ee6a50f8eebdeb2d1c76bab599e3c79ec4abe`, run `30713946002`, artifact `finscope-github-validation-244ee6a50f8e-PASS` (ID `8822770890`, `sha256:a26bdefd2ba3808d8e621902cee78953a3a3d3a650be31d5bb8333bb25449ffa`).

## Cierre

T072, T073, T074, T075, T076 pasan a `COMPLETED`; B17 pasa a `COMPLETED`; B18 queda `PENDING` como único lote activo/autorizado. `activeBatchId=B18`, `nextAuthorizedBatchId=B18`, `convergenceAuthorized=false`.

El cierre cambia únicamente checkboxes, estados, hashes/mirrors derivados, ledger, reportes, contexto y metadata. No cambia producto, tests, workflows, scripts, schemas, dependencias, fixtures ni comportamiento después del candidate PASS. `.specify` conserva 19 archivos y hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.

El control plane post-cierre debe producir 1030/1030 checks PASS y `tasks.md` queda en `44be83b900cd531b63a2d25c5dcb18c8880e140e38d4f1690849f1fe680fbf5d`.
