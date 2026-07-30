# GH0 — GitHub-first bootstrap implementation report

## Estado candidato

Se agregó infraestructura operacional GitHub sin modificar B12, código funcional, tests de producto, dependencias, lockfile, fixtures, contratos ni `.specify`. El primer run se identifica mediante el marcador `[GH0_EXPECT_FAIL_HASH]` en el asunto del commit para demostrar evidencia `_FAILED`; la recuperación usa un commit vacío con el mismo árbol y mantiene byte-idénticos workflows, scripts, schemas, dependencias, tests y checks.

## Estado de producto preservado

B01–B11 y T001–T048 continúan `COMPLETED`. B12/T049–T053 continúan `PENDING`; `activeBatchId=B12`, `nextAuthorizedBatchId=B12`, `convergenceAuthorized=false`.

## Cierre pendiente

GH0 no se considera completed hasta demostrar runs, artifacts, recuperación, allowlist, merge y Release completed.
