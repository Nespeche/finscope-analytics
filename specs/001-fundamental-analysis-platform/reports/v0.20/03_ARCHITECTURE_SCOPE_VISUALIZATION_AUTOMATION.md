# Arquitectura, alcance, información visualizable y automatización — v0.20

## Alcance confirmado

El MVP cubre exclusivamente emisores registrados ante la SEC y resolubles por CIK. No promete cobertura de empresas globales fuera de SEC, CNV, ETF ni universo completo de instrumentos. Un ADR puede mostrarse como alias de instrumento o asociarse a un overlay de precio únicamente si la identidad del emisor está resuelta por CIK.

El precio es opcional y se incorpora mediante CSV o entrada manual. No se agrega proveedor de mercado, BYO-key, cotización en tiempo real ni actualización automática de precio.

## Arquitectura

```text
[Usuario]
   │
   ▼
[Svelte 5 SPA / Pages]
   ├─ UI accesible, consentimiento y recuperación
   ├─ IndexedDB opt-in ── snapshots/overlays/export/restore
   └─ Web Worker tipado
        ├─ selección y normalización XBRL exacta
        ├─ decimal.js + HALF_EVEN
        ├─ 24 métricas + 9 reglas
        ├─ 8 métricas de precio separadas
        └─ JCS/SHA-256 y publicación atómica
   │ red consentida
   ▼
[Cloudflare Worker read-only]
   ├─ allowlist SEC, límites, streaming, Problem Details
   └─ D1 mínimo: versión de catálogos/metadata pública
   │ una subrequest
   ▼
[SEC Submissions / Company Facts / Company Concept exacto]
```

El Worker no normaliza payloads SEC completos. D1 no almacena raw SEC ni datos personales. El reloj local solo sirve presentación y no participa en decisiones normativas o fingerprints.

## Flujo extremo a extremo

1. El usuario resuelve un CIK y concede, o no, consentimiento de red/persistencia.
2. El orquestador aplica cache fresh/stale/expired y consulta Submissions cuando corresponde.
3. Company Facts se adquiere como fuente primaria; Company Concept se usa solo como fallback exacto dentro de 14 llamadas.
4. El Web Worker valida, normaliza, conserva lineage, calcula métricas/calidad/reglas y fingerprints.
5. El candidato se publica en memoria o, con consentimiento, en una transacción IndexedDB.
6. El precio opcional crea un overlay/version/fingerprint separados y recalcula únicamente métricas de precio.

## Información visualizable

### Dato raw

Identidad SEC, CIK, legal name, submissions, filings, forms, accession numbers, filed dates, periodos, conceptos/tags, valores recibidos, unidades, dimensiones y referencias de fuente.

### Dato normalizado

Concepto canónico, FY/trimestre/TTM, scope, moneda, unidad, escala, signo, DecimalString, mapping/version, resolución `resolved|absent|ambiguous|incompatible`, restatement/duplicate/amendment y lineage.

### Métricas fundamentales (24)

`FND_REVENUE`, `FND_REVENUE_GROWTH_YOY`, `FND_REVENUE_GROWTH_QOQ_COMPATIBLE`, `FND_GROSS_MARGIN`, `FND_OPERATING_MARGIN`, `FND_NET_MARGIN`, `FND_CFO`, `FND_CAPEX`, `FND_FCF`, `FND_CASH`, `FND_BORROWINGS_DEBT`, `FND_NET_DEBT`, `FND_CURRENT_RATIO`, `FND_WORKING_CAPITAL`, `FND_EARNINGS_QUALITY`, `FND_DERIVED_EBITDA`, `FND_EBITDA_MARGIN`, `FND_DEBT_EQUITY`, `FND_INTEREST_COVERAGE`, `FND_ROA`, `FND_ROE`, `FND_CASH_CONVERSION`, `FND_CAPEX_REVENUE`, `FND_DILUTED_SHARES_EVOLUTION`.

### Precio histórico (8)

`MKT_LAST_OBSERVATION`, `MKT_MIN`, `MKT_MAX`, `MKT_MEAN`, `MKT_MEDIAN`, `MKT_SIMPLE_RETURN`, `MKT_MAX_DRAWDOWN`, `MKT_TREND_DIRECTION`. Se muestran as-of, rango, frecuencia, observaciones, edad de presentación y disclosure de ajustes; nunca valuación ni recomendación.

### Insights descriptivos (9)

`INS_GROWTH_MARGIN_DETERIORATION`, `INS_EARNINGS_WITHOUT_CASH_CONVERSION`, `INS_DEBT_FUNDED_GROWTH`, `INS_LIQUIDITY_IMPROVEMENT`, `INS_DELEVERAGING`, `INS_PERSISTENT_NEGATIVE_FCF`, `INS_DILUTION`, `INS_INTEREST_COVERAGE_DETERIORATION`, `INS_EBITDA_CASH_DIVERGENCE`. Cada regla informa `triggered|not_triggered|not_evaluable`, polaridad descriptiva, evidencia y limitaciones; no es una recomendación personal.

### Calidad, evidencia y operación

Cobertura, mapping quality, confidence categórica, reason codes, provenance, source evidence, versiones, fingerprints, snapshot activo/histórico, estado de actualización, fresh/stale/expired, partial, errores, retry/cancel/recovery, export/restore y confirmaciones destructivas.

## Automatización clasificada

1. **Automatización real sin intervención:** ninguna mientras la aplicación está cerrada.
2. **Automatización al abrir/reanudar:** sí, solo con `refreshConsent=true`; aplica cache y novelty fingerprint.
3. **Operación mediante botón:** actualización fundamental forzada, cancelación, retry, importación/reemplazo/eliminación de precio, export/restore/delete.
4. **Importación manual:** CSV o entrada manual de precio con preview y confirmación.
5. **Proceso técnico manual prohibido:** terminal, scripts, edición de archivos o comandos como paso esencial del usuario.

La automatización futura está suficientemente definida para implementación: consentimiento, novelty, retries, Retry-After, backoff/jitter inyectable, locks, idempotencia, concurrencia uno, cancelación, partial/stale, commit atómico, rollback y reanálisis dirigido por dependencias.
