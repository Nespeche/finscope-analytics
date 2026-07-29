# Estados, capabilities y recuperación — revisión normativa v0.19.3 / paquete v0.20

**Autoridades ejecutables:** `state-and-capability-catalog.json`, `gateway-problem-details-catalog.json`, `local-operation-issue-catalog.json`.

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

La matriz de transición existe una sola vez en JSON y se prueba con 81 combinaciones: 35 permitidas y 46 prohibidas. Facts, cobertura, métricas, reglas, síntesis y pipeline tienen enums separados.

El gateway tiene 10 variantes Problem Details alcanzables; los issues locales son cinco y nunca se serializan como HTTP. `unsupported_profile` es un resultado normal del análisis.
