# B06 r1 — Análisis de fallo y remediación r2

**Estado:** `R2_IMPLEMENTED_PENDING_EXTERNAL_VALIDATION`  
**Autoridad:** evidencia técnica; no modifica FR/NFR/AC ni abre B07.

## Entradas autenticadas

| Elemento | SHA-256 | Resultado |
|---|---|---|
| `FS_B06_r1.zip` | `b151f5a3df746bfb7c6f447b34bf4bff36d9499d24d4ef2eac60d474356ba723` | candidato r1 íntegro |
| `Run-FinScope-BatchValidation_B06_r1_v1.ps1` | `9580eca84688c3707bed8a9fbfc93a737a8acc31041f2996dcb8295ee992ca5a` | runner r1 íntegro |
| `FinScope_local_evidence_B06_20260726-103544.zip` | `2571813d6bfdf3adf50682985f1b04ac9d2d49a6dfb13f2c7ba939fc4f4da49b` | evidencia funcional FAIL |
| diagnóstico r1 | `d9b14003c074e3f2f3d854f0724eb9e7a7f5cd2eb4b7c2c76f695c09ae4d655f` | diagnóstico secundario FAIL |
| `B06-local-validation.json` | `665afdabdee4aca02d472ce3d60fc3db625377290fc5d9746c1ffae24ba873ef` | 5 PASS, 1 FAIL, 5 NOT_RUN |

## Resultado demostrado

El preflight fue PASS y el plano de control informó 994/994. `npm ci`, Chromium, typecheck, unit e integración pasaron. `test-contract` falló con `SEC_URL_BLOCKED_BY_POLICY`; fail-fast dejó negative, E2E, regresiones y build sin ejecutar.

## Causa funcional

`toSecCikFilename()` produce correctamente `CIK0000320193.json` para Submissions y Company Facts. Company Concept necesita el segmento `CIK0000320193` sin extensión. r1 reutilizó el helper de filename y generó una ruta no permitida.

r2 introduce `toSecCikPathSegment()` y construye exactamente:

`https://data.sec.gov/api/xbrl/companyconcept/CIK0000320193/us-gaap/Revenues.json`

El contrato ahora afirma el URL completo.

## Causa del runner

Vitest registró `Test Files 1 passed` y `Tests 4 passed`, pero con secuencias ANSI. El wrapper r1 aplicó regex sobre el texto coloreado, informó `TEST_DISCOVERY_NOT_PROVEN: command=test-unit` y ocultó el fallo contractual primario.

## Remediación del flujo

`Run-FinScope-BatchValidation_B06_r2_v1.ps1`:

- es el único runner y no invoca el runner interno;
- integra `-PreflightOnly` opcional;
- acepta aliases físicos mediante sidecar y hash;
- ejecuta AST y autopruebas de cultura/JSON/parser antes de npm;
- desactiva color y elimina ANSI;
- deriva los 11 comandos desde B06;
- conserva `primaryFailure`;
- empaqueta logs, contexto, manifiesto e inventario tanto en PASS como en FAIL;
- limpia regenerables y exige restauración exacta del árbol estable.

Runner r2 SHA-256: `2fa388fb0d6744a9d1f86d21e6a0c970294550ef9d6413fd9d6fdeb1812546d8`.

## Estado

La remediación está implementada, no validada ejecutablemente en este entorno por bloqueo del registro npm y ausencia de PowerShell Core. T024–T030 siguen `IMPLEMENTED_PENDING_VALIDATION`; B06 sigue `LOCAL_VALIDATION_REQUIRED`; B07 sigue `PENDING`.
