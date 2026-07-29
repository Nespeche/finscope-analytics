# B03 r4 — Instrucciones de validación local con rutas cortas

## Causa del cambio

La implementación de B03 es la misma que en r3. r4 corrige exclusivamente la entrega y el flujo de extracción para Windows:

- nombre físico corto: `FS_B03_r4.zip`;
- sidecar corto: `FS_B03_r4.zip.sha256`;
- raíz de trabajo obligatoria: `C:\FS\B03r4`;
- no crear una carpeta externa con el nombre largo histórico del candidato;
- usar preferentemente el lanzador reutilizable `Run-FinScope-BatchValidation.ps1` entregado junto al ZIP.

## Estructura requerida

Guarda directamente estos tres archivos en:

```text
C:\FS\B03r4\
```

```text
C:\FS\B03r4\
├─ FS_B03_r4.zip
├─ FS_B03_r4.zip.sha256
└─ Run-FinScope-BatchValidation.ps1
```

No uses el Explorador para crear una carpeta adicional basada en el nombre del ZIP. No reutilices ninguna extracción r1, r2 o r3.

## Ejecución recomendada

Abre una terminal PowerShell 7 en VS Code y ejecuta:

```powershell
New-Item -ItemType Directory -Path 'C:\FS\B03r4' -Force | Out-Null
Set-Location 'C:\FS\B03r4'

pwsh -NoProfile `
  -ExecutionPolicy Bypass `
  -File '.\Run-FinScope-BatchValidation.ps1' `
  -ZipPath '.\FS_B03_r4.zip' `
  -SidecarPath '.\FS_B03_r4.zip.sha256' `
  -WorkRoot 'C:\FS\B03r4' `
  -BatchId B03
```

El lanzador:

1. verifica el SHA-256 contra el sidecar;
2. inspecciona las rutas del ZIP y rechaza traversal, rutas absolutas o raíces múltiples;
3. elimina únicamente una extracción anterior `C:\FS\B03r4\FinScope_v0.21.4`;
4. extrae el candidato en la ruta corta;
5. confirma que ZIP y sidecar están junto a la raíz extraída;
6. ejecuta `Invoke-FinScopeBatchValidation.ps1 -BatchId B03` mediante PowerShell 7.

## Resultado aceptable

Deben registrarse seis comandos requeridos `PASS`, exit code `0`, descubrimiento efectivo de los cinco archivos de prueba, cero `NOT_RUN`, cero `No tests found` y ningún skipped/pending/todo requerido.

El ZIP esperado quedará en:

```text
C:\FS\B03r4\FinScope_local_evidence_B03_YYYYMMDD-HHMMSS.zip
```

Adjunta en el chat de verificación exclusivamente:

1. `FS_B03_r4.zip`;
2. `FS_B03_r4.zip.sha256`;
3. `FinScope_local_evidence_B03_YYYYMMDD-HHMMSS.zip`.

r4 no reemplaza el baseline `completed` presente en Fuentes del Proyecto hasta que la evidencia integral sea verificada y se emita otro ZIP `completed`.
