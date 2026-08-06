# Fallback local — VS Code / PowerShell

Usar solo cuando Chat no pueda ejecutar una acción local o se requiera navegador/entorno del usuario.

Después de aplicar el overlay y crear el commit candidato:

```powershell
Set-Location C:\FS\finscope-analytics
git fetch origin --prune
git status --short
git rev-parse HEAD
node implementation-control/scripts/Validate-ControlPlaneState.mjs .
node implementation-control/scripts/Check-OperationScope.mjs . --mode pr
node implementation-control/scripts/Run-Operation.mjs . .finscope-evidence
```

Para un paquete candidato externo:

```powershell
python implementation-control/scripts/package_release.py --root . --output C:\FS\release --name <ZIP>.zip --status CANDIDATE --dry-run
python implementation-control/scripts/verify_package.py --zip C:\FS\release\<ZIP>.zip --sidecar C:\FS\release\<ZIP>.zip.sha256 --expected-status CANDIDATE --expected-operation-id <operationId>
```

Los paquetes `COMPLETED` deben producirse mediante el workflow Release sobre Git exacto. Devolver SHA, comandos, exit codes, stdout/stderr, evidencia y hashes. No copiar dependencias, builds, caches o evidencia dentro del candidato.
