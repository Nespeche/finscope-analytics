# Reemplazo de Fuentes — SDD2

## No reemplazar todavía

El ZIP `FS_v0.22.0_SDD2_governance_migration_candidate.zip` es candidato; no sustituye B20.

## Reemplazar únicamente cuando

- PR merged exactamente sobre el HEAD validado;
- Release manual PASS y publicado;
- ZIP y sidecar descargados nuevamente;
- `verify_package.py` devuelve PASS con `--expected-status COMPLETED`, `--expected-git-sha <mergeSha>` y `--expected-operation-id sdd2-governance-migration`;
- SHA coincide con sidecar y digest publicado;
- CRC, raíz, paths, metadata, inventory, manifest, source tree, `.specify` y tasks pasan;
- comparación Git confirma procedencia del merge SHA.

## Fuentes

Conservar solamente:

1. ZIP completed descargado del Release SDD2.
2. Sidecar SHA-256 correspondiente.

`BASELINE_LOCK.json` del paquete describe B20 como entrada de la migración; no es la autoidentidad del ZIP SDD2. La identidad del paquete activo está en sus bytes, sidecar y metadata. El siguiente PR B21 actualizará el lock de entrada.

No cargar overlay, evidencia, logs, candidato ni instrucciones en la pareja completed.
