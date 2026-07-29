# Contrato de overlay histórico de precio — revisión normativa v0.19.3 / paquete v0.20

**Estado:** `ACTIVE_OPTIONAL`; **schema:** `../schemas/historical-price-overlay.schema.json`.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

## Propósito

Agregar contexto histórico descriptivo sin alterar la tesis ni los fingerprints fundamentales.

## Invariantes

- Una versión es inmutable.
- Observaciones contienen solo fecha y precio positivo canónico; orden/duplicados se evalúan en el modelo de calidad.
- Moneda, instrumento, venue, frecuencia, adjustment status y origen son explícitos.
- `displayAgeDays`, `evaluationDate`, ranges y counts derivados no se persisten.
- `historicalPriceOverlayFingerprint` excluye timestamps y metadata derivada.
- El único uso activo es `historical_descriptive_only`.
- Importar/borrar precio afecta únicamente overlay, análisis MKT y pointer de precio.

## Calidad

La autoridad es `quality-model-catalog.json#historicalPrice`; nunca se proyectan ejes XBRL al CSV/manual.
