# B11 r2 validation failure and r3 remediation

## Evidencia autenticada

- Evidencia: `FinScope_local_evidence_B11_20260728-124812252_FAILED.zip`.
- SHA-256: `34bb65f09a1909c95ed07cfed5d33d242f067d2d5ea4ce0bf3cdf115227e450a`.
- Candidato r2: `FS_B11_r2.zip` (`3289a833accc609219158a19c0f79d3454b050d321bb29c8278dddd8fdbb8b40`).
- Runner r2 v1: `Run-FinScope-BatchValidation_B11_r2_v1.ps1` (`1cfd764eeb2c1ccc4f80994223ea63f091da51510a4fb003187a24e97d5f5e22`).
- Sidecar, CRC, inventario, manifiesto, schema de evidencia, runner exacto, autocalificación, preflight y plano de control inicial/final: `PASS`.

## Secuencia ejecutada

1. `npm ci`: `PASS`.
2. `npm run typecheck`: `PASS`.
3. Suite unitaria T047: `PASS`, 1 archivo/4 tests.
4. Suite de integración T048: `FAIL` en el primer test; Vitest tenía `bail=1`.
5. Regresión y build: `NOT_RUN` por fail-fast.

## Causa raíz

La prueba esperaba publicación atómica, pero el helper generaba el identificador `fund-bundle-0000320193-fy2025-v1:fundamental-pipeline-ready`. El schema activo exige `^fund-bundle-[a-z0-9-]+$`; los dos puntos no están autorizados. Por ello el builder rechazó correctamente el candidato normalizado, el pipeline lo clasificó como `normalization_failed` y el registry devolvió `preserved`.

No fallaron el pipeline, el registry, los builders, los fingerprints, los datos financieros, el schema ni el runner. El defecto estaba exclusivamente en el dato de prueba construido por `tests/integration/worker/fundamental-pipeline.test.ts`.

## Corrección r3

- Antes: ``bundleId: `${bundle.bundleId}:${operationId}` ``.
- Ahora: ``bundleId: `${bundle.bundleId}-${operationId}` ``.
- Ejemplo corregido: `fund-bundle-0000320193-fy2025-v1-fundamental-pipeline-ready`, válido bajo el schema activo.
- Los cinco archivos productivos B11, la suite unitaria, schemas, fixtures normativos, catálogos, dependencias, `tasks.md`, `B11.json` y `.specify` permanecen byte-idénticos a r2.
- El runner r3 cambia solo identidad de transporte; su lógica es equivalente al runner r2 que ya pasó SelfTest y Preflight.

## Estado

B11 sigue `LOCAL_VALIDATION_REQUIRED`; T047/T048 siguen `IMPLEMENTED_PENDING_VALIDATION`; B12 sigue `PENDING`; `convergenceAuthorized=false`. Solo evidencia fresca con los seis comandos PASS puede promover B11 a `COMPLETED`.
