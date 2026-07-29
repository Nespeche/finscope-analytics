# Modelo de datos normativo

**Revisión normativa del contenido:** v0.19.3  
**Paquete/fase activa:** v0.21

**Estado:** `ACTIVE_HUMAN_MODEL`; los schemas JSON son autoridad ejecutable.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

<a id="issueridentity"></a>
## IssuerIdentity

- `cik`: string de 10 dígitos, clave primaria de identidad.
- `legalName`.
- `accountingStandard`: `us_gaap|ifrs|unknown`.
- `entityType`: `operating_company|financial_institution|insurance|reit|unknown`.
- `analysisProfile`: ID del catálogo de perfiles.

Ticker/symbol es alias de instrumento, no clave de emisor.

## FundamentalBundle

Objeto inmutable validado por `schemas/fundamental-bundle.schema.json`:

- identidad del emisor;
- operación SEC y presupuesto;
- filings y períodos;
- facts canónicos;
- resoluciones de concepto;
- cobertura por perfil;
- versiones;
- `fundamentalInputFingerprint`;
- evidencia separada.

No contiene precio ni análisis de precio.

## FundamentalAnalysis

- `analysisKind=fundamental`.
- referencia al `fundamentalInputFingerprint`.
- resultados de métricas fundamentales.
- evaluaciones de reglas.
- síntesis descriptiva y limitaciones.
- `fundamentalAnalysisFingerprint`.

No contiene overlay, métricas o fingerprint de precio.

## HistoricalPriceOverlay

Objeto inmutable por `(overlayId, overlayVersion)`:

- CIK e instrumento (`symbol`, `venueMic`);
- moneda/frecuencia;
- observaciones ordenadas `date + priceDecimal`;
- disclosure de ajustes;
- origen local/proveedor reservado;
- warnings y quality profile;
- `historicalPriceOverlayFingerprint`.

`displayAgeDays`, `evaluationDate`, ranges derivados y counts derivados no se almacenan. Se calculan para render a partir de observaciones y un argumento explícito.

## PriceAnalysis

- `analysisKind=historical_price_descriptive`.
- referencia al overlay fingerprint.
- quality profile de precio.
- ocho resultados MKT.
- `priceAnalysisFingerprint`.

No contiene métricas/reglas/síntesis fundamental.

## Estados separados

- Fact: `resolved|absent|ambiguous|incompatible`.
- Cobertura: `complete|partial|missing|not_applicable`.
- Métrica: `available|partial|insufficient|not_applicable|not_meaningful`.
- Regla: `triggered|not_triggered|not_evaluable`.
- Síntesis: `insufficient_information|neutral|favorable|unfavorable|mixed`.
- Pipeline: `idle|checking|acquiring|normalizing|analyzing|ready|partial|failed|cancelled`.

No existe conversión implícita entre dominios. Cada consumidor lee su enum específico.

## Persistencia

Stores y claves están definidos en `browser-storage-contract.json`. Relaciones:

```text
IssuerIdentity 1 ── * FundamentalSnapshot
FundamentalSnapshot 1 ── 1 FundamentalBundle
FundamentalSnapshot 1 ── 1 FundamentalAnalysis
IssuerIdentity 1 ── * HistoricalPriceOverlayVersion
HistoricalPriceOverlayVersion 1 ── 0..1 PriceAnalysis
IssuerIdentity 1 ── 1 ActiveFundamentalPointer
IssuerIdentity 1 ── 0..1 ActivePricePointer
```

Pointers no enlazan entre dominios. Borrar precio no puede dejar referencias desde un snapshot fundamental porque dicha referencia no existe.

## Invariantes

1. Records de bundle, análisis, snapshot y overlay son inmutables.
2. Un pointer apunta a un record committed con fingerprint coincidente.
3. Publicación y pointer update ocurren en la misma transacción.
4. No hay fingerprints anidados dentro de su propia proyección.
5. Facts inválidos no ingresan al candidate bundle.
6. Perfil/mapping/version forman parte de la proyección fundamental.
7. Precio y reloj local nunca forman parte de fingerprints fundamentales.


## CacheOperationalRecord

Metadata mutable y no financiera: `issuerCik`, `checkedAt`, `etag`, `lastModified`, `freshnessBand`, `noveltyFingerprint`. `checkedAt` y el reloj local jamás forman parte de fingerprints fundamentales.

## LocalExportPackage

Envelope versionado con manifest, `recordsSha256` y records `{schemaId, recordKind, recordId, payloadSha256, payload}`. Consentimientos y variables de despliegue quedan excluidos. Restore valida todo antes de una única transacción.

## FormulaDefinition

Definición inmutable por `(formulaId, formulaVersion)` con aridad, expresión, orden, política decimal, edge cases y output contract. Cada métrica activa resuelve exactamente una.
