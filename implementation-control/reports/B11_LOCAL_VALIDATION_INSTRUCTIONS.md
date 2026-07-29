# B11 r3 — Validación local en Windows

## 1. Entrada limpia

Eliminar o apartar por completo `C:\FS\B11r2v1`. Crear `C:\FS\B11r3v1\input` y guardar únicamente:

1. `FS_B11_r3.zip`;
2. `FS_B11_r3.zip.sha256`;
3. `Run-FinScope-BatchValidation_B11_r3_v1.ps1`;
4. `Run-FinScope-BatchValidation_B11_r3_v1.ps1.sha256`.

No mezclar r1/r2/r3, no reutilizar un `work` anterior y no extraer manualmente el candidato.

## 2. SelfTestOnly

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B11r3v1\input\Run-FinScope-BatchValidation_B11_r3_v1.ps1 -InputDirectory C:\FS\B11r3v1\input -SelfTestOnly
```

Esperado: `Runner B11 r3 v1 SelfTest PASS`. No continuar si falla.

## 3. PreflightOnly

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B11r3v1\input\Run-FinScope-BatchValidation_B11_r3_v1.ps1 -InputDirectory C:\FS\B11r3v1\input -WorkRoot C:\FS\B11r3v1\work -PreflightOnly
```

Esperado: `Preflight B11 r3 v1 PASS`.

## 4. Validación completa

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B11r3v1\input\Run-FinScope-BatchValidation_B11_r3_v1.ps1 -InputDirectory C:\FS\B11r3v1\input -WorkRoot C:\FS\B11r3v1\work
```

El runner ejecuta con fail-fast:

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run test:unit -- tests/unit/fundamental/bundle-vectors.test.ts`;
4. `npm run test:integration -- tests/integration/worker/fundamental-pipeline.test.ts`;
5. `npm run test`;
6. `npm run build`.

`browserRequired=false`: no instalar Chromium ni ejecutar Playwright. No ejecutar `npm audit fix --force` ni modificar dependencias/lockfile.

## 5. Devolución

Con PASS, adjuntar `FinScope_local_evidence_B11_<timestamp>.zip` y su sidecar. Con FAIL, adjuntar los equivalentes `_FAILED` y cualquier diagnóstico generado.

Solo la evidencia PASS del candidato exacto r3 permite promover B11. El completed B10 sigue siendo el baseline activo hasta ese cierre.
