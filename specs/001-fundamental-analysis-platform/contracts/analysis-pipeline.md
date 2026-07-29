# Contrato del pipeline de análisis — revisión normativa v0.19.3 / paquete v0.20

**Estado:** `ACTIVE`

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

## Etapas

`idle → checking → acquiring → normalizing → analyzing → ready|partial|failed|cancelled` según `state-and-capability-catalog.json#transitions`.

- **checking:** decide cache/novedad/consentimiento.
- **acquiring:** ejecuta política SEC y produce stop object.
- **normalizing:** valida identidad, períodos, scopes, mappings y facts.
- **analyzing:** calidad → métricas fundamentales → reglas AST → síntesis → fingerprints.
- **publicación:** transacción atómica; solo después se alcanza ready/partial.

Una transición no listada está prohibida. `ready→idle` y `partial→idle` existen únicamente por `issuer_cleared` o `local_data_deleted`. Cancelar nunca publica candidate.

Precio utiliza flujo paralelo independiente y no cambia el state fundamental salvo una acción UI de presentación.

## Negative, end-to-end and performance verification v0.19.3

La estrategia futura exige contract tests y negative fixtures para mensajes inválidos, cancellation races, stale operationId, corrupción IndexedDB y payloads oversize. Playwright cubre end-to-end; Vitest cubre unidad/integración. Los performance budgets prohíben cálculo pesado en UI y miden latencia de Worker, memoria y batching incremental.
