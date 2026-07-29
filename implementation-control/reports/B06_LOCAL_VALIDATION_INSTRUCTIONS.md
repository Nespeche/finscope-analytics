# B06 — Instrucciones de validación local r4/v1

## Entradas exactas

Guardar únicamente estos cuatro archivos en `C:\FS\B06r4v1\input`:

1. `FS_B06_r4.zip`;
2. `FS_B06_r4.zip.sha256`;
3. `Run-FinScope-BatchValidation_B06_r4_v1.ps1`;
4. `Run-FinScope-BatchValidation_B06_r4_v1.ps1.sha256`.

El sufijo físico automático `(1)`, `(2)` u otro alias de transporte es aceptado: el runner resuelve la identidad mediante nombre lógico y SHA-256. No renombrar ni editar el contenido.

## Validación completa — un comando

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B06r4v1\input\Run-FinScope-BatchValidation_B06_r4_v1.ps1 -InputDirectory C:\FS\B06r4v1\input -WorkRoot C:\FS\B06r4v1\work
```

El runner integra autenticación, preflight, validación estructural del plano de control, extracción segura, 11 comandos, descubrimiento de pruebas, evidencia, Ajv aislado, segundo control-plane y limpieza. El E2E específico se deriva como `npm run test:browser -- tests/e2e/issuer-selection.spec.ts`; la regresión browser completa se ejecuta después mediante `npm run test:browser`.

### Preflight opcional

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File C:\FS\B06r4v1\input\Run-FinScope-BatchValidation_B06_r4_v1.ps1 -InputDirectory C:\FS\B06r4v1\input -WorkRoot C:\FS\B06r4v1\work -PreflightOnly
```

El preflight opcional debe terminar con `Preflight B06 r4 PASS`. No sustituye la validación completa.

## Resultado esperado

PASS produce en `C:\FS\B06r4v1\input`:

- `FinScope_local_evidence_B06_<timestamp>.zip`;
- su sidecar;
- preflight JSON y sidecar.

FAIL funcional produce `_FAILED.zip` con `primaryFailure`, logs y artefactos Playwright. Un fallo previo a la ejecución produce diagnóstico `_FAILED`.

## Continuidad

`FS_B06_r4.zip` no reemplaza `FS_v0.21.6_B05_completed.zip`. Adjuntar candidato, sidecar, evidencia y sidecar en otra conversación de verificación. B07 permanece `PENDING` y `convergenceAuthorized=false` hasta promoción independiente.
