# B09 r2 — Validación local en Windows

## 1. Carpeta de entrada

Crear `C:\FS\B09r2v1\input` y guardar únicamente:

1. `FS_B09_r2.zip`;
2. `FS_B09_r2.zip.sha256`;
3. `Run-FinScope-BatchValidation_B09_r2_v1.ps1`;
4. `Run-FinScope-BatchValidation_B09_r2_v1.ps1.sha256`.

No extraer manualmente el candidato y no mezclar archivos r1/r2.

## 2. Autocalificación obligatoria

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B09r2v1\input\Run-FinScope-BatchValidation_B09_r2_v1.ps1 -InputDirectory C:\FS\B09r2v1\input -SelfTestOnly
```

Debe terminar con `Runner B09 r2 v1 SelfTest PASS`. Ante FAIL, detenerse.

## 3. Preflight obligatorio

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B09r2v1\input\Run-FinScope-BatchValidation_B09_r2_v1.ps1 -InputDirectory C:\FS\B09r2v1\input -WorkRoot C:\FS\B09r2v1\work -PreflightOnly
```

Debe terminar con `Preflight B09 r2 v1 PASS`. npm comienza únicamente después de este PASS.

## 4. Validación completa

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B09r2v1\input\Run-FinScope-BatchValidation_B09_r2_v1.ps1 -InputDirectory C:\FS\B09r2v1\input -WorkRoot C:\FS\B09r2v1\work
```

El runner deriva y ejecuta literalmente:

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run test:unit -- tests/unit/analytics/formula-vectors.test.ts tests/unit/analytics/fundamental-metric-vectors.test.ts tests/unit/analytics/quality-cartesian.test.ts`;
4. `npm run test`;
5. `npm run build`.

`browserRequired=false`; no corresponde Playwright.

## 5. Archivos a devolver

Resultado PASS esperado:

- `FinScope_local_evidence_B09_<timestamp>.zip`;
- `FinScope_local_evidence_B09_<timestamp>.zip.sha256`.

Ante FAIL, devolver los equivalentes `_FAILED` y, si existe, `FinScope_runner_diagnostic_B09_<timestamp>_FAILED.zip` con su sidecar.

El baseline B08 completed debe conservarse hasta que la evidencia exacta r2 sea verificada y se emita un nuevo completed.
