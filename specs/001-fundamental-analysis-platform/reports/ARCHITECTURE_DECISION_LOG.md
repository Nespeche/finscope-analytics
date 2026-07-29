# Architecture Decision Log — activo v0.19

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

| ADR | Decisión | Estado | Consecuencia |
|---|---|---|---|
| ADR-016-01 | Separar dominio fundamental y dominio de precio | ACCEPTED | snapshots, pointers y fingerprints independientes |
| ADR-016-02 | Company Facts primaria; Company Concept selectivo | ACCEPTED | menor volumen y fallback determinístico |
| ADR-016-03 | Presupuesto SEC 14 | ACCEPTED | 1 Submissions + 1 Company Facts + 12 fallbacks |
| ADR-016-04 | Mappings exactos y perfiles allowlist | ACCEPTED | cobertura limitada explícita; sin fuzzy inference |
| ADR-016-05 | AST JSON cerrado | ACCEPTED | reglas lintables y fixtures completos |
| ADR-016-06 | Modelos de calidad separados | ACCEPTED | precio no hereda semántica XBRL |
| ADR-016-07 | Problem Details solo HTTP | ACCEPTED | issues locales no contaminan OpenAPI |
| ADR-016-08 | IndexedDB atómico y append-only | ACCEPTED | rollback y snapshots inmutables |
| ADR-016-09 | Sin valuación/recomendaciones MVP | ACCEPTED | alcance y riesgo reducidos |
| ADR-016-10 | Constitución 3.0.0 preservada en v0.16 | HISTORICAL | reemplazada por enmienda de gobierno 3.1.0 |

| ADR-019-01 | Constitución 3.1.0 y gate único de fase | ACCEPTED | documentos subordinados no amplían autorizaciones |
| ADR-019-02 | Svelte 5 + Vite + Vitest + Playwright | ACCEPTED | UI client-side separada del Web Worker |
| ADR-019-03 | Retirar tasks v0.18 del flujo activo | ACCEPTED | checklist antes de regeneración total |
| ADR-019-04 | Fixtures SEC congelados como oráculo | ACCEPTED | smoke tests live quedan opcionales |
