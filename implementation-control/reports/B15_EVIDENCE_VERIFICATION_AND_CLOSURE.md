# B15 — Verificación de evidencia y cierre GitHub-first

## Resultado

`PASS`. Baseline `FS_v0.21.17_B14_completed.zip` (`853cdfd12bb605905703e74969992092605666a0644b420995a3000ca3c5708c`), candidate `eeb4d7065be5d0883ef72aaa89de5d07758b1f18`, run `30677021963`, artifact `finscope-github-validation-eeb4d7065be5-PASS` (ID `8810837405`, `sha256:d8d47770d4dd39d9c40eb41d970d00e1696b89331b664f039edecce774a5b904`).

## Cierre

T063, T064, T065, T066, T067, T068 pasan a `COMPLETED`; B15 pasa a `COMPLETED`; B16 queda `PENDING` como único lote activo/autorizado. `activeBatchId=B16`, `nextAuthorizedBatchId=B16`, `convergenceAuthorized=false`.

El cierre cambia únicamente checkboxes, estados, hashes/mirrors derivados, ledger, reportes, contexto y metadata. No cambia producto, tests, workflows, scripts, schemas, dependencias, fixtures ni comportamiento después del candidate PASS. `.specify` conserva 19 archivos y hash `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.

El control plane post-cierre debe producir 1030/1030 checks PASS y `tasks.md` queda en `7400703ae42a981fa8312f7ea1748b642c8264f897027b749906c155ffd11839`.
