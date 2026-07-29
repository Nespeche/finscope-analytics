# Fingerprints y sanitización — revisión normativa v0.19.3 / paquete v0.20

**Estado:** `ACTIVE`; **autoridades:** `fingerprint-projections.json`, `fingerprint-test-vectors.json`, `../schemas/common.schema.json`.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

## Pipeline canónico

1. Validar schema y tipos.
2. Rechazar `NaN`, infinidades, exponentes, `-0` y decimales no canónicos.
3. Seleccionar exclusivamente los paths allowlisted por la proyección.
4. Ordenar arrays según la política del catálogo.
5. Serializar RFC 8785 JCS.
6. SHA-256 de bytes UTF-8.
7. Representar como `sha256:<64 hex lowercase>`.

## Dominios

- `fundamentalInputFingerprint`.
- `fundamentalAnalysisFingerprint`.
- `historicalPriceOverlayFingerprint`.
- `priceAnalysisFingerprint`.
- `sourceEvidenceFingerprint`.

No existe `analysisOutputFingerprint` activo. Ningún fingerprint puede incluirse directa o indirectamente en su propia proyección. Precio, evidencia y reloj local no contaminan fingerprints fundamentales.
