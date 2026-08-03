# Protocolo GitHub de cierre y Release

## Cierre

`FinScope Closure Validation / verify-closure` autentica repositorio, operación, rama, candidate SHA, run y artifact. Descarga el ZIP bruto del artifact, verifica digest, identidad del artifact, manifiesto, schema, batch y baseline, y compara `candidateSha..closureSha` contra la allowlist. Cambios posteriores en producto, tests, workflows, scripts, schemas, dependencias, fixtures o comportamiento producen `FAIL`. No repite npm cuando la allowlist demuestra ausencia de cambios ejecutables.

## Release

Después del merge autorizado, `FinScope Completed Release` verifica que el árbol de `main` coincide con el cierre aprobado. Genera staging con raíz única, conserva `.github`, excluye `.git`, `node_modules`, `dist`, caches, reports temporales y ZIPs anidados, actualiza metadata/inventario/manifiesto, valida control plane y `.specify`, crea ZIP completed y sidecar, y publica assets solo si todos los gates dan PASS.

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
