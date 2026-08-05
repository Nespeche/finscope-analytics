# Protocolo GitHub de validación

## 1. Gate de Pull Request

El workflow `FinScope PR Validation` ejecuta en `ubuntu-latest` con `contents: read`. Primero valida el plano de control. Después autentica el Release completed anterior mediante sus assets personalizados. Resuelve `activeBatchId`, `browserRequired` y `localValidation.commands` desde las autoridades activas.

En etapa `candidate`, ejecuta literalmente todos los comandos requeridos del batch activo. En etapa `closure`, valida baseline, control plane, `.specify` y autopruebas, pero no repite npm: la evidencia ejecutable queda ligada al candidate SHA exacto y el cierre se controla por allowlist.

## 2. Ejecución

Cada comando registra texto literal, cwd, inicio/fin UTC, duración, exit code, stdout/stderr separados, hashes y discovery. El primer fallo conserva `primaryFailure` y marca dependientes `NOT_RUN`. Suites vacías, skipped, pending, omitted, todo o interrumpidas producen `FAIL`. No se hardcodea `checkCount` ni una lista de tests de producto en el workflow.

Chromium se instala únicamente cuando la autoridad resuelta declara `browserRequired=true`, mediante el comando autorizado. No se usan secretos ni servicios externos pagos.

## 3. Evidencia

Siempre se produce un artifact con `github-validation-evidence.json`, logs, preflight, manifest y hashes. El nombre termina en `PASS` o `_FAILED`. La evidencia se relee contra `github-validation-evidence.schema.json` antes del gate final.

Para `github-validation-evidence.json`, el gate final exige dos validaciones sobre los mismos bytes finales: el validador dependency-free con resolución fail-closed de `$ref` locales y Ajv Draft 2020-12. El manifest se escribe únicamente después de ambas. Los resultados `EVIDENCE_SCHEMA_DEPENDENCY_FREE`, `EVIDENCE_SCHEMA_AJV_2020_12`, `EVIDENCE_FINAL_BYTES_REVALIDATED` y `COMMAND_RESULT_REF_EXERCISED` deben derivarse de controles ejecutados; una divergencia nunca se promociona a PASS.

## 4. Autopruebas operativas

Cada ejecución demuestra colecciones nula, vacía, 0, 1 y N; traversal negativo; hash negativo; suite vacía negativa; identidad de Git HEAD; baseline Release; `.specify`; schema y manifest de evidencia. Las pruebas de bootstrap GH0 permanecen preservadas como historial, no como condición hardcodeada de lotes futuros.

## 5. Cierres autenticados independientes

`BATCH_CLOSURE` conserva la autoridad histórica de `handoff.operation` y solo puede promover un lote real `PENDING`. `REMEDIATION_CLOSURE` se resuelve exclusivamente desde la `closurePolicy` de una entrada inequívoca de `handoff.remediations`; nunca consume `handoff.operation`, `handoff.candidate` ni `handoff.closure` como fallback.

En una remediación, `candidate/NOT_REQUESTED` produce `NOT_APPLICABLE`. Solo `closure/PENDING`, con candidato propio completo, habilita `Apply-GitHubRemediationClosure.mjs`. El aplicador autentica run y artifact vivos, digest, manifest, schema dependency-free y Ajv Draft 2020-12, comandos requeridos, ancestry, allowlists e invariantes B21/B22; genera el cierre y crea únicamente el commit local preparado. Después, el control plane y `Verify-GitHubClosure.mjs` deben validar localmente la allowlist y la inmutabilidad de tareas, `IMPLEMENTATION_STATE`, batches, producto y `.specify`. Solo un PASS local permite a `Finalize-GitHubRemediationClosure.mjs` actualizar la rama. La finalización exige que el remoto sea exactamente el request SHA, que el closure SHA sea un descendiente fast-forward, y ejecuta un push normal sin `--force` ni `--force-with-lease`. La evidencia final se genera tras una nueva consulta remota que confirme el closure SHA.

La evidencia `REMEDIATION_CLOSURE` se valida contra `github-remediation-closure-evidence.schema.json` con el validador dependency-free y Ajv Draft 2020-12 sobre los bytes finales. Un PASS exige `localValidation=PASS`, `controlPlaneValidation=PASS`, `remotePushValidation=PASS`, `remoteBranchVerified=true` y `remoteHeadSha=closureSha`. `NOT_APPLICABLE` es un resultado distinto y nunca se presenta como cierre `PASS`.
# Resolución autoritativa de contexto

Antes de `npm ci`, todo workflow debe ejecutar `Resolve-GitHubContext.mjs` con la rama exacta. Solo una operación reconocida, completa, compatible con su stage y cuya `operation.branch` coincida exactamente puede aportar autoridad. En cualquier rama ordinaria, el lote procede de `IMPLEMENTATION_STATE.activeBatchId`, debe coincidir con `nextAuthorizedBatchId`, permanecer `PENDING`, no estar completado y tener dependencias y gates compatibles.

El baseline `CURRENT_COMPLETED_BASELINE` es distinto del `HISTORICAL_OPERATION_BASELINE`. Para B21 ordinario se autentica exclusivamente `v0.21.25-B20-completed`; el B19 histórico solo se admite en la rama exacta de la operación que lo declara. No existe fallback por nombre de archivo.

Las remediaciones se declaran en la colección tipada `GITHUB_HANDOFF.remediations`. Cada entrada fija un `id`, modo reconocido, rama exacta, rol de baseline, allowlist de rutas y comandos literales. `CONTROL_PLANE_REMEDIATION` se reserva para cambios del plano de control y `MAINTENANCE_REMEDIATION` para dependencias, build, seguridad y tooling no normativo.

Antes de `npm ci`, el runner compara el diff exacto del PR con `allowedPaths`. Una ruta no declarada produce `MAINTENANCE_SCOPE_MISMATCH`; una declaración desconocida, incompleta, duplicada o ambigua falla sin fallback a `BATCH`. Los comandos restantes quedan `NOT_RUN` con causa enlazada a `primaryFailure`.

## Paquetes completed

El verificador distingue archivos ordinarios y outputs finales generados. Con acceso al repositorio autenticado, cada archivo ordinario debe existir con bytes idénticos en el commit indicado; la evidencia registra `gitTreeComparisonExecuted`, commit, conteo comparado, outputs permitidos y paths rechazados. Sin acceso Git puede ejecutar controles portátiles, pero debe declarar la comparación Git como no ejecutada. `github-context*.json`, archivos de comandos Actions, temporales, logs, diagnósticos, caches, resultados de tests, `.finscope-*` no autorizados y ZIPs anidados fallan antes de considerar inventario o manifest.


## Push normal de cierre de remediación

El cierre preparado es un commit hijo del request commit. Por ello la actualización profesional predeterminada es un push normal fast-forward. Antes del push se leen y comparan HEAD local, request SHA, closure SHA y HEAD remoto; se exige `git merge-base --is-ancestor requestSha closureSha`. El comando no incluye ninguna opción de force. Si el remoto cambia o el update deja de ser fast-forward, Git rechaza la operación. Después del push se consulta nuevamente la rama y solo `remoteHeadSha=closureSha` puede producir evidencia PASS.

Las ramas de remediación no pueden recibir force pushes por ningún operador. Un cambio concurrente, reset o actualización inesperada invalida el ciclo y exige reautenticación.

## Contrato ejecutable del gate de publicación

La validación de `release-publication-gate-hardening` debe probar sobre los mismos bytes del candidato que `FinScope Completed Release` carece de triggers `push`, `pull_request`, `schedule` y `workflow_run`, y que conserva únicamente `workflow_dispatch` con `expected_main_sha` y `authorization_text` obligatorios.

El contrato debe rechazar ejecutablemente: autorización vacía; texto genérico; SHA esperado distinto; checkout distinto; tag, ZIP o sidecar distintos; espacios adicionales; rama distinta de `main`; evento distinto de `workflow_dispatch`; operación o closure incompletos; `convergenceAuthorized=true`; y tag o Release ya existente. La única aceptación válida es la autorización canónica exacta derivada de `GITHUB_SHA` y de la identidad de `release` en `GITHUB_HANDOFF.json`.

`release.pending=true` sin dispatch y autorización canónica nunca habilita publicación. La configuración de concurrencia debe incluir el SHA y la identidad canónica —que incorpora tag, ZIP y sidecar— y usar `cancel-in-progress: false`; una segunda ejecución queda serializada y luego falla por identidad publicada existente.

Los comandos literales de la remediación son `npm ci`, `npm run typecheck`, `node implementation-control/scripts/Validate-ControlPlaneState.mjs .`, el contrato `tests/contract/github-transition-routing.test.ts`, `npm run test` y `npm run build`. Un fallo detiene dependientes, preserva artifact `_FAILED` y exige un commit nuevo y una ejecución completa nueva; `Re-run jobs` está prohibido.
