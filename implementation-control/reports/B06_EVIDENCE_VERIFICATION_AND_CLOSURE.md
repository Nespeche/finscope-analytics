# B06 — Verificación de evidencia y cierre

## Resultado

`PASS`. El baseline `FS_v0.21.6_B05_completed.zip` (`603cc07bb65f69483c85266aa91ee9b2cf681fe809c98456eea482a71cb78db5`), el candidato exacto `FS_B06_r4.zip` (`ba0914bae946aae20f736c40851b2562d491dd3814c585619557f0f9354b2ce3`), el runner autenticado `Run-FinScope-BatchValidation_B06_r4_v1.ps1` (`17f2ed3c33df3911800f1a23ef6d29d643ae292639d426d949c3f9a24007f6b9`) y la evidencia `FinScope_local_evidence_B06_20260726-145803592.zip` (`0e534024b3ed13060d0c121c15256752b8cd6049fa4a3e7411a25c391a23a46d`) quedaron vinculados por bytes, hashes y sidecars válidos.

## Evidencia ejecutable

- PowerShell 7.6.4 Core; Node v24.18.0; npm 11.16.0;
- 11 comandos obligatorios: 11 PASS, 0 FAIL, 0 NOT_RUN;
- unit: 1 archivo / 4 tests; integración: 2 / 13; contratos: 3 / 9; negativas: 1 / 2;
- E2E focalizado: 2 tests escritorio/móvil; regresión Vitest: 28 archivos / 117 tests; regresión Playwright: 8 tests;
- build: 246 módulos y 3 assets;
- control plane inicial/final: 1025/1025 PASS;
- evidencia validada con el schema activo; stdout/stderr separados y autenticados;
- árbol restaurado después de limpiar `node_modules`, `dist`, `playwright-report` y `test-results`.

El campo `npmExecuted=false` del preflight es intencional: el preflight se ejecuta antes de npm. La ejecución real de `npm ci` está autenticada después con comando literal, logs separados, hash y `exitCode=0`.

## Cierre

T024, T025, T026, T027, T028 y T030 se marcan `[X]`; B06 pasa a `COMPLETED`; T029 permanece `PENDING`; B07 queda `PENDING` como siguiente lote activo/autorizado; `convergenceAuthorized=false`.

La promoción aplica exclusivamente la allowlist de cierre. No se repitieron npm ni pruebas funcionales porque no cambiaron código, tests, runners, scripts npm, schemas, dependencias, fixtures, contratos, comportamiento ni `.specify` después de la evidencia PASS.

## Nota de hash del árbol

La recomputación fuera de Windows del hash agregado del árbol puede variar por el ordenamiento cultural de `Sort-Object`. No existe divergencia de bytes: ZIP, sidecar, manifiesto, inventario, hashes objetivo y estado inicial/final fueron verificados independientemente.

## Control plane post-cierre

`1027/1027 PASS`; 109 tareas; 25 lotes; `tasks.md` `94d6983807f00ea7e1aacf960790c5df9ec93313dd2b5f5549acb2cb0f301978`; `.specify` `e06c8fbab523b824c144bb22b616001a3a4e810bb9daaa793e84d5cbb77c2c09`.

## Comparación contra allowlist

- archivos creados: 2;
- archivos modificados: 41;
- archivos eliminados: 0;
- cambios prohibidos: 0;
- código funcional, tests, runners, scripts, schemas, dependencias, fixtures y contratos: byte-idénticos al candidato validado;
- `tasks.md`: solo seis checkboxes de cierre;
- batches B01–B25: solo hash derivado de `tasks.md`, hashes de líneas y estado B06;
- no corresponde repetir npm.
