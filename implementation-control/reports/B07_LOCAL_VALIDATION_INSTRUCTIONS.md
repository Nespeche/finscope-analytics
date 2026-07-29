# B07 r2 — Instrucciones de validación local

## Archivos de entrada

Guardar en `C:\FS\B07r2v1\input` únicamente:

- `FS_B07_r2.zip`
- `FS_B07_r2.zip.sha256`
- `Run-FinScope-BatchValidation_B07_r2_v1.ps1`
- `Run-FinScope-BatchValidation_B07_r2_v1.ps1.sha256`

No reutilizar `C:\FS\B07r1v2`, no mezclar archivos r1 y no extraer el ZIP manualmente.

## 1. Autocalificación del runner

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B07r2v1\input\Run-FinScope-BatchValidation_B07_r2_v1.ps1 -InputDirectory C:\FS\B07r2v1\input -SelfTestOnly
```

Debe indicar `Runner B07 r2 v1 SelfTest PASS`.

## 2. Preflight sin npm

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B07r2v1\input\Run-FinScope-BatchValidation_B07_r2_v1.ps1 -InputDirectory C:\FS\B07r2v1\input -WorkRoot C:\FS\B07r2v1\work -PreflightOnly
```

Debe indicar `Preflight B07 r2 v1 PASS`.

## 3. Validación completa

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B07r2v1\input\Run-FinScope-BatchValidation_B07_r2_v1.ps1 -InputDirectory C:\FS\B07r2v1\input -WorkRoot C:\FS\B07r2v1\work
```

El runner ejecutará desde el batch B07 los 11 comandos obligatorios y aplicará fail-fast.

## Devolución

Adjuntar siempre el ZIP de evidencia y su sidecar:

- PASS: `FinScope_local_evidence_B07_<timestamp>.zip` y `.zip.sha256`.
- FAIL: `FinScope_local_evidence_B07_<timestamp>_FAILED.zip` y `.zip.sha256`.

No reemplazar el baseline B06 completed ni iniciar B08 hasta promoción expresa.
