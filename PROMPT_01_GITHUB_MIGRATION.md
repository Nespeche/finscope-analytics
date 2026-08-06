# Operación única — migración FinScope SDD2

Trabaja en `Nespeche/finscope-analytics` y ejecuta exclusivamente la operación declarada como `sdd2-governance-migration`.

## Material adjunto obligatorio

Autentica antes de consultar o mutar GitHub:

1. `FS_v0.22.0_SDD2_governance_migration_candidate.zip`;
2. su sidecar SHA-256;
3. `FinScope_SDD2_GitHub_Migration_Overlay.zip`;
4. su sidecar SHA-256;
5. `AUDIT_REPORT_SDD2.md`;
6. `MIGRATION_GUIDE_SDD2.md`;
7. `VALIDATION_SUMMARY_SDD2.md`;
8. `DELIVERY_MANIFEST_SDD2.json`.

Autentica también la pareja completed B20 disponible en Fuentes. Lee `V0.21_PHASE_STATUS.md`, `AUTHORITY_MATRIX.json`, `IMPLEMENTATION_STATE.json`, `BASELINE_LOCK.json`, `OPERATION.json` y esta instrucción.

## Preflight GitHub

Consulta el estado real. La base esperada es:

`main@db9588c7256529b6f119f23abb1b17dbd14fa6dc`

Si `main` difiere, si la rama ya existe con otra identidad, o si cualquier hash/sidecar/manifiesto falla, detente sin mutar y devuelve `BASE_SHA_CHANGED`, `BRANCH_IDENTITY_CONFLICT` o `MATERIAL_INVALID`, según corresponda. No adaptes el overlay silenciosamente.

## Autorización exclusiva

1. crear `governance/sdd2-professionalization` desde el SHA esperado;
2. aplicar el overlay y sus eliminaciones exactas;
3. verificar que `.specify`, `specs`, `src`, `workers`, `public` y `package-lock.json` no cambian;
4. ejecutar el validador del plano de control;
5. crear un único commit intencional de migración y hacer push de la rama;
6. abrir un PR Draft contra `main`;
7. obtener la validación GitHub exact-head mediante `sdd-pr-validation.yml`;
8. conservar y reportar cualquier `FAIL` o `ENVIRONMENT_BLOCKED` sin promoverlo.

Los comandos obligatorios son los declarados en `OPERATION.json`: control plane, `npm ci`, typecheck, contract, regresión, build y package dry-run. El scope debe validarse sobre el commit candidato con `Check-OperationScope.mjs . --mode pr`.

No autorizo Ready for Review, merge, tag, Release, sustitución de Fuentes, activación de B21 ni convergencia. No uses el cuerpo del PR como autorización, no crees commit de cierre y no guardes run IDs, artifact IDs o estados de Actions en archivos normativos.

Si desde Chat no es posible ejecutar el overlay o los comandos locales, no hagas una mutación parcial: devuelve el procedimiento exacto para VS Code y los archivos/resultados que deben regresar al chat.

## Entrega

Devuelve: autenticación de materiales, `main` observado, rama, commit/HEAD, diff y allowlist, invariantes protegidas, comandos/resultados, PR Draft, checks/artifacts y el siguiente gate exacto. No encadenes el paso posterior.
