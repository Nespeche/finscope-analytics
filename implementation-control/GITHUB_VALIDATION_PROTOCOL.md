# Protocolo GitHub de validación

## 1. Gate de Pull Request

El workflow `FinScope PR Validation` ejecuta en `ubuntu-latest` con `contents: read`. Primero valida el plano de control. Después autentica el Release completed anterior mediante sus assets personalizados. Resuelve `activeBatchId`, `browserRequired` y `localValidation.commands` desde las autoridades activas.

En etapa `candidate`, ejecuta literalmente todos los comandos requeridos del batch activo. En etapa `closure`, valida baseline, control plane, `.specify` y autopruebas, pero no repite npm: la evidencia ejecutable queda ligada al candidate SHA exacto y el cierre se controla por allowlist.

## 2. Ejecución

Cada comando registra texto literal, cwd, inicio/fin UTC, duración, exit code, stdout/stderr separados, hashes y discovery. El primer fallo conserva `primaryFailure` y marca dependientes `NOT_RUN`. Suites vacías, skipped, pending, omitted, todo o interrumpidas producen `FAIL`. No se hardcodea `checkCount` ni una lista de tests de producto en el workflow.

Chromium se instala únicamente cuando la autoridad resuelta declara `browserRequired=true`, mediante el comando autorizado. No se usan secretos ni servicios externos pagos.

## 3. Evidencia

Siempre se produce un artifact con `github-validation-evidence.json`, logs, preflight, manifest y hashes. El nombre termina en `PASS` o `_FAILED`. La evidencia se relee contra `github-validation-evidence.schema.json` antes del gate final.

## 4. Autopruebas operativas

Cada ejecución demuestra colecciones nula, vacía, 0, 1 y N; traversal negativo; hash negativo; suite vacía negativa; identidad de Git HEAD; baseline Release; `.specify`; schema y manifest de evidencia. Las pruebas de bootstrap GH0 permanecen preservadas como historial, no como condición hardcodeada de lotes futuros.
# Resolución autoritativa de contexto

Antes de `npm ci`, todo workflow debe ejecutar `Resolve-GitHubContext.mjs` con la rama exacta. Solo una operación reconocida, completa, compatible con su stage y cuya `operation.branch` coincida exactamente puede aportar autoridad. En cualquier rama ordinaria, el lote procede de `IMPLEMENTATION_STATE.activeBatchId`, debe coincidir con `nextAuthorizedBatchId`, permanecer `PENDING`, no estar completado y tener dependencias y gates compatibles.

El baseline `CURRENT_COMPLETED_BASELINE` es distinto del `HISTORICAL_OPERATION_BASELINE`. Para B21 ordinario se autentica exclusivamente `v0.21.25-B20-completed`; el B19 histórico solo se admite en la rama exacta de la operación que lo declara. No existe fallback por nombre de archivo.

Las remediaciones se declaran en la colección tipada `GITHUB_HANDOFF.remediations`. Cada entrada fija un `id`, modo reconocido, rama exacta, rol de baseline, allowlist de rutas y comandos literales. `CONTROL_PLANE_REMEDIATION` se reserva para cambios del plano de control y `MAINTENANCE_REMEDIATION` para dependencias, build, seguridad y tooling no normativo.

Antes de `npm ci`, el runner compara el diff exacto del PR con `allowedPaths`. Una ruta no declarada produce `MAINTENANCE_SCOPE_MISMATCH`; una declaración desconocida, incompleta, duplicada o ambigua falla sin fallback a `BATCH`. Los comandos restantes quedan `NOT_RUN` con causa enlazada a `primaryFailure`.

## Paquetes completed

El verificador distingue archivos ordinarios y outputs finales generados. Con acceso al repositorio autenticado, cada archivo ordinario debe existir con bytes idénticos en el commit indicado; la evidencia registra `gitTreeComparisonExecuted`, commit, conteo comparado, outputs permitidos y paths rechazados. Sin acceso Git puede ejecutar controles portátiles, pero debe declarar la comparación Git como no ejecutada. `github-context*.json`, archivos de comandos Actions, temporales, logs, diagnósticos, caches, resultados de tests, `.finscope-*` no autorizados y ZIPs anidados fallan antes de considerar inventario o manifest.
