# Catálogo de métricas — v0.19.2

**Autoridad ejecutable:** `metric-catalog.json`  
**Activas:** 32 = 24 fundamentales + 8 históricas de precio.  
**Fixtures:** 96 = 3 por métrica.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

Cada entry declara `metricId`, class, formulaId, inputIds, unit, rounding, period/scope policy, profile allowlist, quality model/minimum, consumers, allowed states, definition version, fingerprint domain y `metricPriority` único.

Correcciones normativas: FND_REVENUE usa input `revenue`; deuda y EBITDA derivados admiten `usable_with_caveats`; MKT_TREND_DIRECTION usa pendiente OLS normalizada y es flat si `abs(slope) <= 0.001`.
