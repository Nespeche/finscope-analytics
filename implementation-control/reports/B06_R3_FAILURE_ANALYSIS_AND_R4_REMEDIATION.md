# B06 r3 — análisis de evidencia FAIL y remediación r4

## Evidencia autenticada

- Candidato: `FS_B06_r3.zip`, SHA-256 `42ea9a69f1deb33c14aba4e6ca9c47f7837bac51e7487805908d3cc69740a335`.
- Runner: `Run-FinScope-BatchValidation_B06_r3_v1.ps1`, SHA-256 `15fa706d0b7b2deaa5db8cab33887a9c1465bf8b87b1724662062555b6d2935b`.
- Evidencia: `FinScope_local_evidence_B06_20260726-134751447_FAILED.zip`, SHA-256 `f1915acdf77afa759297d33fafe8ed657ecef774f6f314228ad3b712184c04cd`.
- Preflight y control plane inicial/final: `994/994 PASS`.
- Esquema de evidencia: `PASS`.

## Resultado ejecutable

Pasaron `npm-ci`, Chromium, typecheck, unidad (4), integración (13), contratos objetivo (9), negativos (2) y E2E objetivo desktop/mobile (2). `regression-vitest` falló; `regression-browser` y build quedaron `NOT_RUN` por fail-fast.

## Causa raíz

`IMPLEMENTATION_STATE.json.validationWorkflow` contenía cinco campos de transporte del runner: `singleRunnerRequired`, `activeRunner`, `activeRunnerSha256`, `independentPreflightScriptRequired` e `integratedPreflightSwitch`. La autoridad estructural `implementation-state.schema.json` declara `additionalProperties=false` y solo permite la regla de promoción, protocolo, esquema de evidencia y lotes pendientes. La regresión Ajv rechazó correctamente el documento.

Estos datos no pertenecen al estado normativo. La identidad y configuración del runner ya se registran en `PACKAGE_METADATA.json`, informes e instrucciones operativas.

## Remediación r4

1. Se eliminaron los cinco campos no autorizados de `IMPLEMENTATION_STATE.json` sin ampliar el esquema.
2. Se mantuvo `pendingRuntimeValidationBatches=["B06"]` y todos los gates/estados previos.
3. `Validate-ControlPlaneState.mjs` ahora incluye un validador estructural sin dependencias para el subconjunto utilizado por los esquemas operativos.
4. El preflight valida los cuatro documentos de control y los 25 lotes antes de npm.
5. El validador incluye autopruebas de aceptación válida y rechazo de propiedades adicionales.
6. Se añadió un contrato explícito que impide volver a almacenar metadatos de transporte del runner dentro del estado normativo.
7. Se conserva el runner único, el parser ANSI, el Ajv aislado y los artefactos browser demostrados por r3.

## Estado

No hay promoción. B06 continúa `LOCAL_VALIDATION_REQUIRED`; T024–T030 permanecen `IMPLEMENTED_PENDING_VALIDATION`; B07 `PENDING`; convergencia cerrada. r4 requiere una nueva ejecución completa de los 11 comandos.
