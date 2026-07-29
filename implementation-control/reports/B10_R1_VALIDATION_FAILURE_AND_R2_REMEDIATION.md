# B10 r1 validation failure and r2 remediation

## Evidencia autenticada

- Evidencia: `FinScope_local_evidence_B10_20260728-003221644_FAILED.zip`.
- SHA-256: `4bff6dfadd1f8eec8c4bfa4a4bb0930107f529a37465cb98fc18df8635c7e444`.
- Candidato r1: `FS_B10_r1.zip` (`50a0cfda8966ce85420ea880e4af6d299c6e3837c33934ed021fefbce0df192e`).
- Runner ejecutado: `Run-FinScope-BatchValidation_B10_r1_v2.ps1` (`8a3f4e3c8b33389f83cd7fb69173abf92f5a9909cd1a14ecf2ecb167ac694936`).
- Sidecar externo, CRC, manifiesto de evidencia, inventario, preflight, plano de control y vinculación candidato/runner: `PASS`.

## Resultado exacto

1. `npm ci`: `PASS`, exit code 0.
2. `npm run typecheck`: `PASS`, exit code 0.
3. Pruebas focalizadas B10: `PASS`; 3 archivos y 47 tests.
4. `npm run test`: `FAIL`; un test contractual falló en `tests/contract/authority-loading.test.ts`.
5. `npm run build`: `NOT_RUN` por fail-fast.

El error exacto fue `AuthorityLoadError: Explicit anchor does not exist: #gate` al resolver `V0.21_PHASE_STATUS.md#gate`.

## Causa raíz

El baseline completed B09 contenía el ancla normativa explícita `<a id="gate"></a>`. Durante la actualización documental del candidato B10 r1, `V0.21_PHASE_STATUS.md` fue reescrito y esa línea se omitió, aunque `AUTHORITY_MATRIX.json`, `authority-crosswalk.json`, B10 y el test contractual siguieron apuntando exactamente a `V0.21_PHASE_STATUS.md#gate`.

El loader actuó correctamente: su política fail-closed prohíbe inferir un ancla desde el encabezado Markdown. El fallo no está en T044, T045 o T046, ni en reglas, síntesis, fingerprints o variables financieras.

## Corrección r2

- Restaurada exactamente `<a id="gate"></a>` inmediatamente antes de `## Gate`.
- Runtime y pruebas B10: byte-idénticos a r1.
- `.specify`, `spec.md`, `tasks.md`, schemas, catálogos, fixtures y `batches/B10.json`: sin cambios.
- Conservada la corrección del preflight de runner v2 para excluir `FILE_MANIFEST.sha256` y `PACKAGE_INVENTORY.json` del conteo autorreferencial.
- Candidato actualizado a `FS_B10_r2.zip` y runner a `Run-FinScope-BatchValidation_B10_r2_v1.ps1` porque cambió el paquete.

No se relajó el loader, no se cambió el crosswalk y no se deshabilitó ninguna prueba. Esas alternativas habrían debilitado la resolución exacta de autoridades.

## Estado

B10 permanece `LOCAL_VALIDATION_REQUIRED`; T044–T046 permanecen `IMPLEMENTED_PENDING_VALIDATION`; B11 sigue `PENDING`; `convergenceAuthorized=false`. El candidato r2 debe repetir los cinco comandos completos y devolver evidencia autenticada PASS.
