> **HISTÓRICO — B02 cerrado el 2026-07-23.** No volver a ejecutar estas instrucciones para promover el baseline completado.

# B02 — Validación local del candidato r6 en Windows/VS Code

## Archivos de entrada

Guarda juntos en una carpeta nueva y vacía:

- `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip`;
- `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip.sha256`.

No reutilices la extracción, `node_modules`, `dist`, reportes ni evidencia de r5. El PASS informado para r5 es una referencia de no regresión, no evidencia válida para el árbol r6. El baseline completado `authority_alignment_ready` y su sidecar permanecen sin cambios en Fuentes del Proyecto.

## Carpeta recomendada

```text
C:\FinScope\B02-r6\
```

## Verificación y extracción limpia

```powershell
Set-Location 'C:\FinScope\B02-r6'

$zip = '.\FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip'
$sidecar = '.\FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_B02_local_validation_candidate_r6.zip.sha256'

if (-not (Test-Path -LiteralPath $zip)) { throw 'No se encontró el ZIP r6.' }
if (-not (Test-Path -LiteralPath $sidecar)) { throw 'No se encontró el sidecar r6.' }

$expected = ((Get-Content -LiteralPath $sidecar -Raw).Trim() -split '\s+')[0].ToLowerInvariant()
$actual = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Write-Host "SHA esperado: $expected"
Write-Host "SHA real:     $actual"
if ($actual -ne $expected) { throw 'El SHA-256 no coincide.' }

Expand-Archive -LiteralPath $zip -DestinationPath 'C:\FinScope\B02-r6' -Force
Set-Location 'C:\FinScope\B02-r6\FinScope_v0.21.2'

Get-Location
Test-Path -LiteralPath '.\package.json'
Test-Path -LiteralPath '.\implementation-control\scripts\Invoke-FinScopeBatchValidation.ps1'
```

Los dos `Test-Path` deben devolver `True`. ZIP y sidecar deben permanecer inmediatamente por encima de la raíz extraída; el script los verifica de nuevo y compara archivo/extracción antes de npm.

## Validación completa

Desde la raíz extraída ejecuta exactamente:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force
.\implementation-control\scripts\Invoke-FinScopeBatchValidation.ps1 -BatchId B02
```

No uses `-SkipNpmCi` ni `-SkipBrowserInstall`. Cualquier omisión queda `NOT_RUN` y fuerza evidencia `FAIL`.

La secuencia normativa es:

1. `npm ci`;
2. `npm exec playwright install chromium`;
3. `npm run typecheck` — ahora debe compilar realmente el gateway;
4. control plane de discovery y schemas;
5. integración D1;
6. contratos B02, incluida composición;
7. E2E shell desktop/mobile;
8. regresión Vitest completa;
9. regresión Playwright completa;
10. build Vite.

El resultado aceptable registra diez comandos `PASS`, exit code 0, cero `NOT_RUN`, cero “No tests found”, cero skipped/pending/todo requeridos y dos ejecuciones E2E aprobadas.

## Evidencia a devolver

El script crea fuera de la raíz:

```text
C:\FinScope\B02-r6\FinScope_local_evidence_B02_YYYYMMDD-HHMMSS.zip
```

Adjunta en un chat posterior exactamente:

1. el ZIP r6;
2. su sidecar r6;
3. el ZIP de evidencia r6.

Devuelve el bundle también ante FAIL. No edites la extracción, no repitas manualmente comandos para sustituir fallos y no envíes solo capturas o logs sueltos.

## Promoción

r6 y su sidecar permanecen fuera de Fuentes del Proyecto. Solo un paquete posterior `completed`, emitido tras verificar una evidencia r6 integralmente PASS, puede reemplazar `authority_alignment_ready`.
