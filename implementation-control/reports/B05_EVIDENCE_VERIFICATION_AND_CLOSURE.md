# B05 — Verificación de evidencia y cierre

## Resultado

`PASS`. El candidato exacto `FS_B05_r1.zip` (`1532d0ac3d830c4e74bf3aeef6c7f8f342a3a2460706d04d2a13250d996ea3ad`), el runner autenticado `Run-FinScope-BatchValidation_B05_r1_v6.ps1` (`587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079`) y la evidencia `FinScope_local_evidence_B05_20260725-232642920.zip` (`c7da945f9d9e705bec933156c9838d910ec5c46ca9fdbada20f30b5e8263fe4b`) quedaron vinculados por hashes y sidecars válidos.

## Evidencia ejecutable

- PowerShell externo `7.6.4 Core`; cultura `es-AR`, UI `es-MX`.
- nueve comandos obligatorios derivados de `batches/B05.json`: 9 PASS, 0 FAIL, 0 NOT_RUN;
- integración: 2 archivos / 8 tests;
- E2E focalizado: 4 tests;
- accesibilidad focalizada: 2 tests;
- regresión Vitest: 22 archivos / 90 tests;
- regresión browser: 6 tests;
- build: 123 módulos, 3 assets, 555867 bytes;
- control plane de evidencia: 995/995 inicial y final;
- árbol, archivos inspeccionados y `.specify` invariantes.

## Cierre

T021–T023 se marcan `[X]`; B05 pasa a `COMPLETED`; B06 queda `PENDING` como siguiente lote activo/autorizado; `convergenceAuthorized=false`.

La incorporación de `implementation-control/reports/EXTERNAL_VALIDATION_RELIABILITY.md` se trató como cambio documental posterior a evidencia PASS. La comparación por allowlist resultó `PASS`: no cambiaron código, tests, runners, scripts, schemas, dependencias, fixtures, contratos ni `.specify`; por ello no se repitieron npm ni pruebas funcionales. El control plane post-cierre resultó `994/994 PASS` con B06 como lote activo, frente a `995/995` en la evidencia con B05 activo.

## Incidente B05-VALIDATION-001

El falso negativo `INVALID_COMMAND_TIMESTAMP` del wrapper se resolvió con v6 mediante preservación de strings JSON, parseo ISO invariant, autopruebas culturales, autenticación SHA-256, preflight sin npm y evidencia diagnóstica. El runner defectuoso v3 solo está referenciado por el bug report y no fue adjuntado para verificación independiente.

## Salvedad operacional

v6 no contiene un artefacto AST explícito independiente. Su ejecución prueba sintaxis válida para ese archivo, pero el preflight AST separado queda como control futuro no bloqueante y requiere una revisión versionada/autorizada.
