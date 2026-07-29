# Contrato de bundle fundamental — revisión normativa v0.19.3 / paquete v0.20

**Estado:** `ACTIVE`; **schema:** `../schemas/fundamental-bundle.schema.json`.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

## Invariantes

1. Company Facts figura como fuente primaria y el total de llamadas SEC no supera 14.
2. Facts usan decimal canónico, mapping exacto/versionado y sourceRef.
3. Fact states y coverage states son campos distintos.
4. El bundle es inmutable y no contiene precio, análisis de precio ni reloj local.
5. `fundamentalInputFingerprint` se calcula únicamente con la proyección homónima.
6. Un candidate inválido no se publica; el snapshot activo anterior permanece intacto.

La serialización ejecutable y campos requeridos están definidos en el schema; este Markdown no introduce campos adicionales.

## Period, restatement and lineage policy v0.19.3

- `FY` identifica el cierre fiscal anual declarado por el filing; no se infiere desde el año calendario.
- `trimestral` identifica hechos de trimestre fiscal con `fp` y duración compatibles; no se mezclan instant y duration facts.
- `TTM` se construye únicamente desde cuatro periodos trimestrales consecutivos, comparables y sin solapamiento; si falta uno, el resultado queda no disponible.
- Todo `restatement` o amendment conserva el hecho anterior, el accession nuevo, filed date, form y razón de selección; nunca sobrescribe evidencia raw.
- `lineage` enlaza raw fact → selección → normalización → snapshot → fórmula → KPI → insight mediante IDs y hashes resolubles.
- Moneda, escala, unidad, signo, periodo, dimensiones, quality y confidence son obligatorios o producen reason codes explícitos.
