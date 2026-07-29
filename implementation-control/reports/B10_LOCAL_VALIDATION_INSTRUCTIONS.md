# B10 r2 — Validación local en Windows

## 1. Preparar entrada limpia

Crear `C:\FS\B10r2v1\input` y guardar únicamente:

1. `FS_B10_r2.zip`;
2. `FS_B10_r2.zip.sha256`;
3. `Run-FinScope-BatchValidation_B10_r2_v1.ps1`;
4. `Run-FinScope-BatchValidation_B10_r2_v1.ps1.sha256`.

No mezclar archivos r1/v1 o r1/v2 ni extraer manualmente el candidato.

## 2. Autocalificación

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B10r2v1\input\Run-FinScope-BatchValidation_B10_r2_v1.ps1 -InputDirectory C:\FS\B10r2v1\input -SelfTestOnly
```

Esperado: `Runner B10 r2 v1 SelfTest PASS`.

## 3. Preflight

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B10r2v1\input\Run-FinScope-BatchValidation_B10_r2_v1.ps1 -InputDirectory C:\FS\B10r2v1\input -WorkRoot C:\FS\B10r2v1\work -PreflightOnly
```

Esperado: `Preflight B10 r2 v1 PASS`. Este preflight conserva la corrección de exclusión de los dos archivos autorreferenciales del manifiesto/inventario.

## 4. Validación completa

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B10r2v1\input\Run-FinScope-BatchValidation_B10_r2_v1.ps1 -InputDirectory C:\FS\B10r2v1\input -WorkRoot C:\FS\B10r2v1\work
```

Ejecuta en orden y con fail-fast:

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run test:unit -- tests/unit/analytics/rule-vectors.test.ts tests/unit/analytics/synthesis.test.ts tests/unit/fingerprints/fingerprint-vectors.test.ts`;
4. `npm run test`;
5. `npm run build`.

`browserRequired=false`.

## 5. Devolución

Adjuntar:

- `FinScope_local_evidence_B10_<timestamp>.zip`;
- `FinScope_local_evidence_B10_<timestamp>.zip.sha256`.

Si falla, devolver los equivalentes `_FAILED` y cualquier diagnóstico generado. El completed B09 continúa siendo el baseline activo hasta evidencia r2 PASS autenticada.
