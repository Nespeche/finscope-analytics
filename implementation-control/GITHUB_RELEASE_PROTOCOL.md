# Protocolo GitHub de cierre y Release

## Cierre

`FinScope Closure Validation / verify-closure` autentica repositorio, operación, rama, candidate SHA, run y artifact. Descarga el ZIP bruto del artifact, verifica digest, identidad del artifact, manifiesto, schema, batch y baseline, y compara `candidateSha..closureSha` contra la allowlist. Cambios posteriores en producto, tests, workflows, scripts, schemas, dependencias, fixtures o comportamiento producen `FAIL`. No repite npm cuando la allowlist demuestra ausencia de cambios ejecutables.

## Release

Después del merge autorizado, `FinScope Completed Release` verifica que el árbol de `main` coincide con el cierre aprobado. Genera staging con raíz única, conserva `.github`, excluye `.git`, `node_modules`, `dist`, caches, reports temporales y ZIPs anidados, actualiza metadata/inventario/manifiesto, valida control plane y `.specify`, crea ZIP completed y sidecar, y publica assets solo si todos los gates dan PASS.

`release.pending=true` no constituye autoridad de publicación por sí solo. El resolver habilita el workflow únicamente para una operación `RELEASE_REMEDIATION` en stage `completed`, con rama no vacía, candidate completo, closure `COMPLETED` autenticado y vinculado al mismo candidate SHA, commit de cierre válido, identidad completa de Release y `convergenceAuthorized=false`. Los stages `candidate` y `closure`, las operaciones de mantenimiento y cualquier `pending=false` se clasifican `NOT_APPLICABLE`; una intención `completed`/`pending=true` incompleta falla de forma cerrada.

La identidad publicada es inmutable: tag, revisión de paquete, ZIP y sidecar nunca se reutilizan. Un Release rechazado permanece intacto como evidencia histórica y se desactiva mediante `release.pending=false`; no se elimina ni se convierte en baseline. Una revisión limpia posterior debe declarar un tag, ZIP y sidecar nuevos antes de volver a solicitar publicación.

El Release se crea primero como draft. Luego se genera `GITHUB_RELEASE_HANDOFF.json` con tag, commit, release ID, run IDs, artifact IDs y hashes; se valida contra su schema, se cargan los assets y recién entonces se publica. Un fallo nunca publica el Release.

Los assets mínimos, derivados de `GITHUB_HANDOFF.json`, son:

- ZIP completed;
- sidecar SHA-256;
- evidencia/reporte del Release;
- `GITHUB_RELEASE_HANDOFF.json`;
- prompt del siguiente batch autorizado.

`Source code (zip)` y `Source code (tar.gz)` no son baseline normativo.

## Procedencia y reautenticación

El staging completed se extrae exclusivamente de los blobs del commit Git exacto. Los outputs finales generados tienen una allowlist cerrada; una denylist independiente se aplica antes de inventario, antes de manifest y en el verificador. Inventory y manifest nunca pueden legitimar un path temporal o ajeno al árbol Git.

Publicar no completa la autenticación. Después de `draft=false`, el workflow vuelve a consultar el Release por tag, exige Release ID/commit y cinco assets únicos, comprueba estado, tamaño y digest GitHub, descarga nuevamente cada asset, compara bytes, sidecar y CRC, y ejecuta el verificador con comparación Git, control plane y `.specify` desde extracción limpia. El resultado JSON/Markdown se sube como artifact. Una falla preserva evidencia `_FAILED`, no reemplaza assets y no borra un Release ya publicado.

## Portabilidad e identidad del archivo ZIP completed

- Un completed package debe ser un ZIP real; un TAR renombrado con extensión `.zip` es inválido.
- `release.pending=true` no sustituye la autenticación de la operación completed, del candidate ni del closure vinculados.
- En Windows no se permite resolver `tar` mediante PATH para crear el completed package. El único fallback autorizado es `%SystemRoot%\System32\tar.exe`, invocado sin shell y con vector de argumentos.
- El nombre de salida del archiver debe ser relativo al directorio de staging y conservar una raíz única.
- En sistemas no Windows, la ausencia de Info-ZIP debe producir un fallo cerrado; no se admite generar un TAR con extensión ZIP.
- Antes de calcular el sidecar y ejecutar el verificador completed, el archivo debe acreditar una firma ZIP `PK` válida.
- Una identidad de Release rechazada permanece como evidencia histórica y nunca se reutiliza; una revisión limpia requiere tag, ZIP y sidecar nuevos.

## Gate independiente de publicación

El merge, el cierre autenticado y la publicación son tres autorizaciones distintas. Un merge a `main`, un PR Ready, `release.pending=true` o una operación `RELEASE_REMEDIATION/completed` no despachan ni autorizan por sí solos `FinScope Completed Release`.

El workflow de publicación admite exclusivamente `workflow_dispatch`. Se prohíben `push`, `pull_request`, `schedule`, `workflow_run` y cualquier otro evento automático. El dispatch exige los inputs `expected_main_sha` y `authorization_text`; la autorización válida se construye únicamente desde `GITHUB_SHA`, `release.tag`, `release.zipName` y `release.sidecarName` con este formato exacto, sin espacios ni texto adicional:

`AUTHORIZE_FIN_SCOPE_RELEASE_PUBLICATION|main=<SHA>|tag=<TAG>|zip=<ZIP>|sidecar=<SIDECAR>`

Antes de preparar assets, el resolver y el workflow deben comprobar conjuntamente: evento `workflow_dispatch`; rama `main`; checkout igual a `GITHUB_SHA`; `expected_main_sha=GITHUB_SHA`; operación `RELEASE_REMEDIATION/completed`; `release.pending=true`; closure `COMPLETED` ligado al candidate; `convergenceAuthorized=false`; identidad canónica exacta; y ausencia del tag y del Release. Cualquier diferencia falla de forma cerrada.

La concurrencia se serializa por `GITHUB_SHA` y por la autorización canónica, que incorpora tag, ZIP y sidecar, con `cancel-in-progress: false`. Una ejecución posterior con la misma identidad debe encontrar el tag o Release ya existente y fallar antes de preparar una segunda publicación.

Todas las verificaciones previas de baseline, ancestry, allowlist, paquete, assets y reautenticación post-publicación permanecen obligatorias. Cualquier `FAIL` conserva artifact `_FAILED`, limpia únicamente un draft creado por esa ejecución y no publica. La remediación `release-publication-gate-hardening` en `candidate/NOT_REQUESTED` formaliza el contrato técnico, pero no autoriza cierre, dispatch, tag ni Release.
