# Guía de migración a FinScope SDD2

## Estado inicial

- Baseline completed vigente: B20, SHA-256 `c18b1390...`.
- `main` esperado: `db9588c...`, merge de PR #46.
- B21–B25 pendientes; B21 no se inicia durante la migración.

## Nuevo Proyecto ChatGPT

1. Crear `FinScope Analytics SDD2`.
2. Copiar en Configuración `PROJECT_CONFIGURATION_INSTRUCTIONS_SDD2.txt`.
3. Cargar en Fuentes únicamente el ZIP completed B20 y su sidecar.
4. Abrir un chat nuevo y adjuntar, en orden:
   1. ZIP candidato SDD2;
   2. sidecar del candidato;
   3. overlay GitHub;
   4. sidecar del overlay;
   5. auditoría;
   6. esta guía;
   7. resumen de validación;
   8. manifiesto de entrega.
5. Pegar `PROMPT_01_GITHUB_MIGRATION.md`.
6. Reconsultar `main`. Si no es el SHA esperado, detenerse; no adaptar el overlay.
7. Crear la rama declarada, aplicar el overlay, validar, crear un commit y abrir PR Draft.
8. Esperar exact-head PASS. Ready y merge son autorizaciones separadas.
9. Ejecutar el Release manual con merge SHA y `operation_id=sdd2-governance-migration`.
10. Descargar los assets, verificar status `COMPLETED`, operationId y sourceGitSha.
11. Sustituir Fuentes únicamente con esa pareja publicada.
12. Abrir otro chat con `PROMPT_02_IMPLEMENT_B21.md`, que actualizará el baseline de entrada y constituirá B21.

`OPERATION.json` dentro del Release seguirá siendo la declaración de la migración. Esto es correcto: su ciclo terminal vive en GitHub y la siguiente operación reemplaza la declaración.

## Fallback VS Code

```powershell
New-Item -ItemType Directory -Force C:\FS\SDD2 | Out-Null
Expand-Archive .\FinScope_SDD2_GitHub_Migration_Overlay.zip C:\FS\SDD2\overlay
Set-Location C:\FS\SDD2\overlay\FinScope_SDD2_GitHub_Migration_Overlay
.\Apply-SDD2-Migration.ps1 -RepoRoot C:\FS\finscope-analytics -ExpectedMainSha db9588c7256529b6f119f23abb1b17dbd14fa6dc
```

Después ejecutar los comandos de `OPERATION.json`, revisar `git diff --check` y no hacer commit si alguna validación determinista falla.
