# Registro de reemplazos y diferimientos — revisión normativa v0.19.3 / paquete v0.21

La autoridad ejecutable es `replacement-and-deferral-register.json`.

| Artefacto | Estado | Reemplazo | Razón |
|---|---|---|---|
| `contracts/canonical-market-contract.md` | `REPLACED` | `schemas/historical-price-overlay.schema.json`<br>`contracts/historical-price-import.md` | MVP uses independent local historical overlay, not a central market feed |
| `contracts/market-venue-registry.md` | `DEFERRED_POST_MVP` | — | no provider-backed market acquisition in MVP |
| `contracts/provider-adapter.md` | `DEFERRED_POST_MVP` | — | provider adapters are disabled; IDs reserved and normalized |
| `definitions/valuation-compatibility-policy.md` | `DEFERRED_POST_MVP` | — | valuation and investment recommendations are outside MVP |
| `analysisOutputFingerprint` | `REPLACED` | `fundamentalAnalysisFingerprint`<br>`priceAnalysisFingerprint` | fundamental and price domains require independent projections |
| `HTTP 422 unsupported_profile` | `REPLACED` | `normal unsupported_profile analysis outcome` | profile support is a local domain decision, not a gateway request error |
| `HTTP 409 local conflicts` | `REPLACED` | `definitions/local-operation-issue-catalog.json` | identity ambiguity, cancellation, quality gate and storage consent are local operation issues |
| `v0.14 Markdown-only metric/rule/mapping/state authorities` | `REPLACED` | `definitions/*.json`<br>`schemas/*.json`<br>`fixtures/**/*.json` | machine-readable authorities introduced in v0.16 and retained through v0.20 are deterministic and lintable |
| `v0.19 baseline, reports and phase status` | `HISTORICAL_EVIDENCE` | — | v0.19 is historical and non-normative for the active v0.20 package |
| `v0.19.1 checklist-remediation baseline` | `HISTORICAL_EVIDENCE` | — | preserved evidence; no active authority |
| `v0.18 active tasks draft` | `REPLACED` | `reports/v0.19/V0.18_TASKS_DRAFT_SUPERSEDED.md`<br>`tasks.md` v0.20 | replaced by independently authorized and QA-validated tasks |

| `v0.19.2 checklist-remediation baseline` | `HISTORICAL_EVIDENCE` | — | retained only to explain the initial independent control failures |
| `v0.19.3 independent-checklist-verified baseline` | `HISTORICAL_BASELINE` | `V0.20_PHASE_STATUS.md`<br>`tasks.md`<br>`reports/v0.20/` | immediately preceding verified baseline superseded by the tasks-ready package |
| `v0.20 tasks-ready baseline` | `HISTORICAL_BASELINE` | `V0.21_PHASE_STATUS.md`<br>`tasks.md`<br>`reports/v0.21/` | immediate historical baseline; original ANA-001..ANA-013 evidence preserved |
| `v0.21 post-analysis-remediated baseline` | `ACTIVE_BASELINE` | `V0.21_PHASE_STATUS.md`<br>`tasks.md`<br>`reports/v0.21/` | active package; implementation authorized and convergence closed |

## Transición v0.19.2 → v0.19.3

v0.19.2 queda `HISTORICAL_BASELINE` inmediato. Sus informes previos son `EVIDENCE` y no prueban conformidad. v0.19.3 reemplaza únicamente la autoridad activa mediante el gate, índice, presupuesto Cloudflare Free, trazabilidad y controles remediados; la constitución y `.specify` permanecen intactos.

## Transición v0.19.3 → v0.20

v0.19.3 queda `HISTORICAL_BASELINE` inmediato. v0.20 agrega `tasks.md`, trazabilidad y QA, y abre exclusivamente análisis. No modifica `.specify` ni autoriza implementación.

## Transición v0.20 → v0.21

v0.20 queda `HISTORICAL_BASELINE` inmediato. v0.21 remedia exclusivamente ANA-001..ANA-013, conserva los informes históricos, vuelve a ejecutar análisis desde cero y habilita implementación sin abrir convergencia.
