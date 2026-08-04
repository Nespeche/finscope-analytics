# B21 — Gate extraordinario de recuperación de promoción

## Estado

`ACTIVE — NEW_EXACT_HEAD_CANDIDATE_REQUIRED`

El baseline completed vigente continúa siendo B20:

- tag: `v0.21.25-B20-completed`;
- ZIP: `FS_v0.21.25_B20_completed.zip`;
- SHA-256: `c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`.

B21 y T001–T095 permanecen `COMPLETED`, pero el reemplazo
`v0.21.27-B21-completed-r2` todavía no es un baseline de Fuentes.

## Causa de activación

El HEAD `61e9fd9e6bca41575c3687852f33ae09ee3c7f28` produjo el run
`30918159636` en `FAIL` con `MAINTENANCE_SCOPE_MISMATCH`, porque los dos
reportes de cierre históricos estaban presentes en el diff del PR pero no en la
allowlist de validación de la remediación.

Además, ese HEAD contiene cambios ejecutables posteriores al cierre autenticado
del candidato `490cd0e0cd8b65054a1f4e259aaa7163f635aa97`; por ello la evidencia anterior
no puede promover el nuevo árbol.

## Continuidad del hold tras el cierre autenticado

El cierre `e2ada789f260e71e03fd3c0b1ad8f9486b096932`, run `30933284189`,
permanece como evidencia histórica autenticada `PASS`, pero no es promovible
porque la PR Validation posterior sobre `1741c3bb2cc9793b49cc632bd1c3b570a38dca1e`
falló en `allowlist-integrity-contract`.

El artifact `8902033963`, `finscope-github-validation-1741c3bb2cc9-_FAILED`,
digest `sha256:c80813d0e1277f8cb0157e02405593e60c3d17366b1b5cbe0756bf2820857e8d`,
queda preservado como `REJECTED_NOT_PROMOTABLE`. La causa registrada es
`POST_CLOSURE_STATE_COUPLED_CONTRACT_REMEDIATION`.

La remediación `b21-final-release-promotion-remediation` vuelve exclusivamente
a `candidate/NOT_REQUESTED`, sin candidato ni cierre cargados. El hold continúa
activo hasta una PR Validation completa `PASS` vinculada al nuevo HEAD exacto.

## Gate obligatorio

1. Restablecer la remediación a `candidate/NOT_REQUESTED`.
2. Incluir todas las rutas de salida de cierre dentro de la allowlist padre.
3. Ejecutar todos los comandos declarados contra un HEAD nuevo exacto.
4. Exigir `PASS`, cero `FAIL`, cero `NOT_RUN` y artefacto autenticado.
5. Solicitar un cierre nuevo, atómico y vinculado exclusivamente a ese candidato.
6. Autorizar por separado Ready for Review y merge.
7. Autorizar por separado tag y Release.
8. Descargar nuevamente ZIP y sidecar publicados y reautenticarlos.
9. Reemplazar Fuentes solo después de la reautenticación post-publicación.
10. Habilitar B22 únicamente cuando `release.pending=false`.

## Operaciones bloqueadas

Mientras este gate esté activo no se autoriza:

- Ready for Review;
- merge;
- tags o Releases;
- reemplazo de Fuentes;
- inicio de B22 o lotes posteriores;
- convergencia;
- modificación de producto, tareas, batches o `.specify`.

El FAIL y los reportes de cierre anteriores se conservan como evidencia histórica
no promovible.
