# B09 r1 validation failure and r2 remediation

## Evidencia autenticada

- Evidencia: `FinScope_local_evidence_B09_20260727-221234687_FAILED.zip`.
- SHA-256 de evidencia: `cbbb02e698a469f224c0001ee05c29ff4625e509b6c20dfb024b8ff5a5467167`.
- Candidato r1: `FS_B09_r1.zip` (`2f384dbcb3399ff9bca19ae4d44325c71219310854985607ad652c666de4faeb`).
- Runner r1: `Run-FinScope-BatchValidation_B09_r1_v1.ps1` (`5fd8b7653ecec92200fca2a2fdb698b024363d04f09606a1b35b8a87bbc882b7`).
- Sidecars, CRC, manifiesto de evidencia, inventario, schema de evidencia, preflight, plano de control y hashes del candidato/runner: consistentes.

## Resultado exacto

1. `npm ci`: PASS.
2. `npm run typecheck`: PASS.
3. Suite focalizada B09: FAIL; 3 archivos descubiertos, 117 tests, 116 PASS y 1 FAIL.
4. `npm run test`: `NOT_RUN` por fail-fast.
5. `npm run build`: `NOT_RUN` por fail-fast.

El único fallo fue:

`tests/unit/analytics/formula-vectors.test.ts > closed formula engine > rejects all seven normative negative vector instances through the closed schema`.

## Causa raíz

La prueba r1 creó una instancia aislada de Ajv y registró solamente `formula-vectors.schema.json`. Ese schema contiene la referencia externa:

`https://finscope.local/schemas/common.schema.json#/$defs/DecimalString`

pero `common.schema.json` no fue registrado en esa instancia. Ajv, por lo tanto, no pudo resolver `DecimalString` y abortó antes de validar los siete vectores negativos.

No es un error de las variables financieras, de `formulaId`, de `inputs`, de las 15 fórmulas ni de las 24 métricas. Es un error de configuración de la prueba: faltaba conectar el schema dependiente con el registry de schemas ya implementado por T012.

## Alternativas y riesgo

- **Aplicada — usar `createProductSchemaValidator()`:** riesgo funcional **ninguno**. La prueba usa el registry normativo que registra los 26 schemas, resuelve referencias locales, configura formatos y aplica la política strict autorizada.
- Registrar manualmente `common.schema.json` en el Ajv local: riesgo bajo, pero duplica configuración y puede volver a desalinearse del registry; descartada.
- Copiar `DecimalString` dentro de `formula-vectors.schema.json`, eliminar el `$ref`, relajar Ajv o saltar la prueba: riesgo alto y contrario a AUTH-036/T012; descartada.

## Cambio r2

- Runtime de producto: byte-idéntico a r1.
- Fórmulas, calidad, métricas, fixtures, catálogos, schemas normativos y contratos: sin cambios.
- Único test funcional corregido: `tests/unit/analytics/formula-vectors.test.ts`.
- La prueba ahora valida los siete casos negativos mediante `createProductSchemaValidator()` y el fragmento `formula-vectors.schema.json#/$defs/vector`.
- `.specify`, `spec.md`, `tasks.md` y `implementation-control/batches/B09.json`: sin cambios.
- Runner: misma lógica; identidad actualizada a `Run-FinScope-BatchValidation_B09_r2_v1.ps1` porque cambió el candidato.

## Estado y cierre

B09 permanece `LOCAL_VALIDATION_REQUIRED`; T041, T043 y T042 permanecen `IMPLEMENTED_PENDING_VALIDATION`; B10 permanece `PENDING`; `convergenceAuthorized=false`.

Los dos comandos PASS de r1 no pueden reutilizarse para promover r2. El candidato exacto `FS_B09_r2.zip` debe ejecutar nuevamente los cinco comandos y devolver evidencia PASS autenticada.
