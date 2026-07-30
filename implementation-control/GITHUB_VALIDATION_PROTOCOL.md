# Protocolo GitHub de validación

## 1. Gate de Pull Request

El workflow `FinScope PR Validation` ejecuta en `ubuntu-latest` con `contents: read`. Primero valida el plano de control. Después autentica el Release completed anterior mediante sus assets personalizados. Resuelve `activeBatchId`, `browserRequired` y `localValidation.commands` desde las autoridades activas.

Durante la única migración GH0, el workflow registra literalmente los comandos de B12 pero ejecuta la matriz de calificación operacional declarada en `GITHUB_HANDOFF.json`; esto evita implementar o simular T049–T053. Fuera de la rama bootstrap, ejecuta literalmente los comandos del batch activo.

## 2. Ejecución

Cada comando registra texto literal, cwd, inicio/fin UTC, duración, exit code, stdout/stderr separados, hashes y discovery. El primer fallo conserva `primaryFailure` y marca dependientes `NOT_RUN`. Suites vacías, skipped, pending, omitted, todo o interrumpidas producen `FAIL`. No se hardcodea `checkCount` ni una lista de tests de producto en el workflow.

Chromium se instala únicamente cuando la autoridad resuelta declara `browserRequired=true`, mediante el comando autorizado. No se usan secretos ni servicios externos pagos.

## 3. Evidencia

Siempre se produce un artifact con `github-validation-evidence.json`, logs, preflight, manifest y hashes. El nombre termina en `PASS` o `_FAILED`. La evidencia se relee contra `github-validation-evidence.schema.json` antes del gate final.

## 4. Calificación GH0

GH0 debe demostrar: sintaxis, control plane, baseline PASS, hash negativo, traversal negativo, suite vacía negativa, artifact PASS y `_FAILED`, relectura del schema, regresión completa, browser y build, `.specify` idéntico y recuperación de un run fallido sin alterar checks.
