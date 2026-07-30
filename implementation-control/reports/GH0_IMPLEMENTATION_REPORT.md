# GH0 — GitHub-first bootstrap implementation report

## Estado candidato r4

GH0 incorpora infraestructura operacional GitHub sin implementar B12 ni modificar código funcional, fixtures, contratos de producto, dependencias, lockfile, tareas, batches o `.specify`.

El candidato r3 creó y publicó el commit `5007cc25599e038f53e44a04b52a2c177bd2eefa`. Todos los comandos locales pasaron. El runner informó FAIL únicamente porque la API del PR devolvió temporalmente el SHA anterior después de que la rama remota ya había avanzado. GitHub Closure concluyó correctamente `NOT_APPLICABLE` con workflow SUCCESS.

GitHub PR Validation autenticó el Release B11, pasó control plane, npm ci, Chromium, typecheck y diez E2E. Vitest descubrió 54 pruebas y 53 pasaron; `control-plane-integrity.test.ts` falló porque el validador escribió un JSON grande mediante `console.log` y llamó inmediatamente a `process.exit`. En stdout canalizado de Linux, el proceso terminó antes de vaciar por completo el buffer y produjo JSON truncado.

El candidato r4 cambia exclusivamente la emisión final del validador a escritura síncrona en stdout/stderr y usa `process.exitCode`, luego repite toda la regresión obligatoria.

## Estado de producto preservado

B01–B11 y T001–T048 continúan `COMPLETED`. B12/T049–T053 continúan `PENDING`; `activeBatchId=B12`, `nextAuthorizedBatchId=B12`, `convergenceAuthorized=false`.

## Cierre pendiente

GH0 no se considera completed hasta que el candidato r4 obtenga PR Validation PASS, se autentique su artifact, se aplique el cierre documental allowlisted, Closure produzca PASS real, el PR sea mergeado de forma autorizada y el Release completed publique ZIP/sidecar personalizados.
