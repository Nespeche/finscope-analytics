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
