# Contrato de importación de precio histórico — v0.19.2

## Límites

CSV UTF-8, BOM permitido, máximo 5 MiB, 50.000 filas, 8 columnas y 128 caracteres por celda. Solo fecha y precio de cierre mapeados se procesan. Precio debe ser DecimalString canónico positivo. Se rechazan NUL, binario, fórmulas de hoja, required fields no mapeados y fechas duplicadas sin resolución explícita.

<a id="normative-flow"></a>

## Flujo normativo

1. Leer sin escribir.
2. Validar tamaño/encoding/estructura/límites.
3. Parsear todas las filas y normalizar fechas/precios.
4. Resolver duplicados mediante rechazo y explicación; no elegir silenciosamente.
5. Mostrar preview, issues y scope: CIK, instrumento, MIC, moneda, frecuencia y ventana.
6. Confirmar.
7. Crear nueva `overlayVersion` inmutable y `priceAnalysis` candidate.
8. Validar schema/fingerprints.
9. Publicar atómicamente el pointer de precio.

El proceso nunca modifica fundamentales ni sus fingerprints.

## CSV grammar, validation and atomicity v0.19.3

- Encoding is UTF-8, optional UTF-8 BOM; delimiter is comma; quote is `"`; embedded delimiters require RFC 4180 quoting; line ending may be LF or CRLF.
- Header matching is exact after trim and case-fold against an allowlist. Unknown columns are rejected unless explicitly marked ignorable; missing required columns are invalid.
- Maximum size is 5 MiB, 50,000 rows, 8 columns and 128 characters per cell.
- Duplicate dates are invalid unless the preview exposes them and the user chooses the deterministic replacement policy; silent duplicate handling is prohibited.
- Spreadsheet-formula prefixes `=`, `+`, `-`, `@` after optional whitespace are rejected to prevent CSV injection.
- The complete file is parsed, sanitized, schema-validated and previewed before any write. Commit is atomic; any failure triggers rollback and preserves the previous overlay.
- Import does not perform restore or schema migration; those operations belong to the versioned local export/restore contract.
