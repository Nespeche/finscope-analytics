# B11 r1 validation failure and r2 remediation

## Evidencia autenticada

- Evidencia: `FinScope_local_evidence_B11_20260728-120326874_FAILED.zip`.
- SHA-256: `4798e0984269a56c5f7b4ec25962d15ec6f3bee8f004cef8cd48aa9b3ea81b2`.
- Candidato r1: `FS_B11_r1.zip` (`b088457da0d8538ce89346efc21c21a7afc2b1eb1cb25c7f34d2fc94cf7e90ca`).
- Runner: `Run-FinScope-BatchValidation_B11_r1_v1.ps1` (`ebbee32a878e9c0e1c3015231f108c3a41ae6ce6d4e9af67e381ffcd399144ac`).
- Sidecars, CRC, manifiesto e inventario de evidencia, runner exacto, preflight, ancla `gate` y plano de control inicial/final: `PASS`.

## Resultado exacto

1. `npm ci`: `PASS`, exit code 0.
2. `npm run typecheck`: `PASS`, exit code 0.
3. `npm run test:unit -- tests/unit/fundamental/bundle-vectors.test.ts`: `FAIL`; 1 archivo y 4 tests descubiertos, 3 PASS y 1 FAIL.
4. Integración, regresión y build: `NOT_RUN` por fail-fast.

El único error fue la aserción de la línea 207. La prueba esperaba que el mensaje incluyera `DecimalString`, pero recibió correctamente `Decimal string is not canonical: "1000.00"`.

## Causa raíz

El builder funcionó correctamente: delegó en el servicio canónico completado `src/core/decimal.ts`, que rechazó `1000.00` mediante `DecimalStringError` con código `NON_CANONICAL_DECIMAL`. El defecto estaba solamente en el oráculo de prueba, que dependía de una palabra concreta del mensaje en lugar del tipo y código semánticos.

No fallaron los builders, el pipeline, las variables financieras, el lineage, los schemas, el fingerprint service ni el runner.

## Corrección r2

- Se cambia únicamente `tests/unit/fundamental/bundle-vectors.test.ts`.
- La aserción ahora exige `name=DecimalStringError` y `code=NON_CANONICAL_DECIMAL`.
- Runtime productivo, schemas, fixtures, catálogos, `B11.json`, `tasks.md`, FR/NFR/AC y `.specify`: byte-idénticos a r1.
- El caso negativo no se elimina ni se relaja; queda más preciso y menos dependiente del texto humano del error.
- Candidato: `FS_B11_r2.zip`.
- Runner con identidad actualizada, lógica equivalente: `Run-FinScope-BatchValidation_B11_r2_v1.ps1` (`1cfd764eeb2c1ccc4f80994223ea63f091da51510a4fb003187a24e97d5f5e22`).

Cambiar el mensaje de producción o eliminar el caso negativo fueron rechazados porque modificarían un servicio completado o debilitarían la cobertura sin necesidad.

## Estado

B11 permanece `LOCAL_VALIDATION_REQUIRED`; T047 y T048 permanecen `IMPLEMENTED_PENDING_VALIDATION`; B12 permanece `PENDING`; `convergenceAuthorized=false`. Los PASS de r1 no promueven r2: el candidato exacto r2 debe repetir los seis comandos completos y devolver evidencia autenticada PASS.
