# B05 — Instrucciones de validación local (histórico cerrado)

**Estado:** `COMPLETED`. Este documento conserva la trazabilidad del handoff que produjo la evidencia aceptada; no debe reutilizarse para B06.

## Entradas exactas verificadas

- `FS_B05_r1.zip` — `1532d0ac3d830c4e74bf3aeef6c7f8f342a3a2460706d04d2a13250d996ea3ad`;
- `Run-FinScope-BatchValidation_B05_r1_v6.ps1` — `587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079`;
- evidencia resultante `FinScope_local_evidence_B05_20260725-232642920.zip` — `c7da945f9d9e705bec933156c9838d910ec5c46ca9fdbada20f30b5e8263fe4b`.

Ruta usada por la evidencia: `C:\FS\B05r1v6`. PowerShell `7.6.4 Core`.

## Comandos derivados de B05

1. `npm ci`
2. `npm exec playwright install chromium`
3. `npm run typecheck`
4. `npm run test:integration -- tests/integration/persistence/db-schema.test.ts tests/integration/worker/operation-registry.test.ts`
5. `npm run test:e2e -- tests/e2e/consent.spec.ts`
6. `npm run test:accessibility -- tests/accessibility/primitives.spec.ts`
7. `npm run test`
8. `npm run test:browser`
9. `npm run build`

Todos finalizaron PASS. Para lotes futuros consultar `EXTERNAL_VALIDATION_RELIABILITY.md`, crear un runner nuevo `rN_vM`, no reutilizar v6 y derivar siempre los comandos del batch activo.
