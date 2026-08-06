# GitHub Protocol SDD2

1. Autenticar Fuentes y resolver `main`; comparar con `BASELINE_LOCK.expectedGitHubBase.mainSha` y `OPERATION.base.expectedSha`.
2. Crear la rama exacta declarada. No reutilizar una rama con historia o HEAD incompatibles.
3. Aplicar la allowlist. Tras crear el commit candidato, ejecutar `Check-OperationScope.mjs . --mode pr`.
4. Abrir PR Draft; el cuerpo informa, pero no autoriza.
5. `sdd-pr-validation.yml` liga repo, base, rama, ancestry y HEAD; ejecuta todos los comandos y conserva evidencia PASS/FAIL/BLOCKED.
6. Solo el owner cambia a Ready y mergea exactamente el HEAD validado.
7. `sdd-release.yml` se dispara manualmente con merge SHA, operationId, tag y nombre lógico del ZIP.
8. El Release revalida scope y comandos, exige árbol tracked limpio, empaqueta desde `git ls-files`, crea draft, descarga y reautentica los assets; solo entonces publica.
9. El operador descarga ZIP y sidecar publicados, ejecuta `verify_package.py` y reemplaza Fuentes.
10. La operación siguiente reemplaza `OPERATION.json` y actualiza `BASELINE_LOCK.operationInput`; la anterior no se reescribe para guardar estados de GitHub.

No usar re-run para fallos deterministas. Un mismo SHA puede repetirse solo tras `ENVIRONMENT_BLOCKED` sin cambio de bytes.
