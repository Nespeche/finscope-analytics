# B08 r2/v1 — Instrucciones de validación externa corregida

## 1. Archivos exactos

Guardar únicamente estos cuatro archivos en `C:\FS\B08r2v1\input`:

1. `FS_B08_r2.zip`;
2. `FS_B08_r2.zip.sha256`;
3. `Run-FinScope-BatchValidation_B08_r2_v1.ps1`;
4. `Run-FinScope-BatchValidation_B08_r2_v1.ps1.sha256`.

Retirar de esa carpeta todos los archivos r1. Los sufijos físicos `(1)`, `(2)` u otros son aliases de transporte válidos. No extraer manualmente el candidato ni mezclar revisiones.

## 2. Autocalificación obligatoria

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B08r2v1\input\Run-FinScope-BatchValidation_B08_r2_v1.ps1 -InputDirectory C:\FS\B08r2v1\input -SelfTestOnly
```

Debe finalizar con `Runner B08 r2 v1 SelfTest PASS`. Si falla, no continuar.

## 3. Preflight sin npm

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B08r2v1\input\Run-FinScope-BatchValidation_B08_r2_v1.ps1 -InputDirectory C:\FS\B08r2v1\input -WorkRoot C:\FS\B08r2v1\work -PreflightOnly
```

Debe finalizar con `Preflight B08 r2 v1 PASS`. El runner autentica candidato, runner y sidecars; valida ZIP, CRC, raíz, rutas, extracción, manifiesto, inventario, metadata, `.specify`, schemas, locks, mirrors, autoridades y archivos objetivo. No ejecuta npm.

## 4. Validación completa

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B08r2v1\input\Run-FinScope-BatchValidation_B08_r2_v1.ps1 -InputDirectory C:\FS\B08r2v1\input -WorkRoot C:\FS\B08r2v1\work
```

Deriva literalmente desde `implementation-control/batches/B08.json` y ejecuta con fail-fast:

1. `npm ci`;
2. `npm run typecheck`;
3. `npm run test:unit -- tests/unit/fundamental/debt-resolver.test.ts tests/unit/fundamental/fact-sanitizer.test.ts tests/unit/fundamental/mapping-resolver.test.ts tests/unit/fundamental/period-resolver.test.ts tests/unit/fundamental/profile-resolver.test.ts`;
4. `npm run test`;
5. `npm run build`.

`browserRequired=false`: no instala Chromium ni ejecuta Playwright.

## 5. Resultado esperado y evidencia

La suite focalizada debe descubrir 5 archivos y al menos 20 pruebas, sin fallos, skips, pending ni suites vacías. Los cinco comandos deben terminar con exit code 0.

Adjuntar después:

- `FinScope_local_evidence_B08_<timestamp>.zip`;
- `FinScope_local_evidence_B08_<timestamp>.zip.sha256`;
- el candidato r2 y su sidecar;
- el runner r2/v1 y su sidecar.

No reemplazar el baseline completed B07 hasta verificar la evidencia PASS y emitir un nuevo completed B08.
