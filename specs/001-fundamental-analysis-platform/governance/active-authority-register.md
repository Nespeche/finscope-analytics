# Registro activo de autoridades — paquete v0.21 / contenido v0.19.3

La autoridad ejecutable es `authority-crosswalk.json`. Todas las rutas resuelven desde `packageRoot` con case exacto, sin basename, fallback ni heurísticas.

| authorityId | Dominio | Autoridad primaria |
|---|---|---|
| `AUTH-001` | `constitution` | `.specify/memory/constitution.md#core-principles` |
| `AUTH-002` | `product_scope` | `specs/001-fundamental-analysis-platform/spec.md#scope-and-non-goals` |
| `AUTH-003` | `issuer_identity` | `specs/001-fundamental-analysis-platform/data-model.md#issueridentity` |
| `AUTH-004` | `accounting_profiles` | `specs/001-fundamental-analysis-platform/definitions/accounting-profile-catalog.json#/profiles` |
| `AUTH-005` | `sec_acquisition` | `specs/001-fundamental-analysis-platform/contracts/sec-acquisition-policy.json#/orderedSteps` |
| `AUTH-006` | `xbrl_mapping` | `specs/001-fundamental-analysis-platform/definitions/xbrl-mapping-catalog.json#/mappings` |
| `AUTH-007` | `fundamental_bundle` | `specs/001-fundamental-analysis-platform/schemas/fundamental-bundle.schema.json` |
| `AUTH-008` | `fundamental_quality` | `specs/001-fundamental-analysis-platform/definitions/quality-model-catalog.json#/fundamental` |
| `AUTH-009` | `price_overlay` | `specs/001-fundamental-analysis-platform/schemas/historical-price-overlay.schema.json` |
| `AUTH-010` | `price_quality` | `specs/001-fundamental-analysis-platform/definitions/quality-model-catalog.json#/historicalPrice` |
| `AUTH-011` | `metrics` | `specs/001-fundamental-analysis-platform/definitions/metric-catalog.json#/metrics` |
| `AUTH-012` | `rules` | `specs/001-fundamental-analysis-platform/definitions/insight-rule-catalog.json#/rules` |
| `AUTH-013` | `rule_ast` | `specs/001-fundamental-analysis-platform/schemas/rule-node.schema.json` |
| `AUTH-014` | `fingerprints` | `specs/001-fundamental-analysis-platform/contracts/fingerprint-projections.json#/projections` |
| `AUTH-015` | `pipeline_states` | `specs/001-fundamental-analysis-platform/definitions/state-and-capability-catalog.json#/transitions` |
| `AUTH-016` | `incremental_updates` | `specs/001-fundamental-analysis-platform/definitions/state-and-capability-catalog.json#/incrementalEvents` |
| `AUTH-017` | `local_storage` | `specs/001-fundamental-analysis-platform/contracts/browser-storage-contract.json#/transactions` |
| `AUTH-018` | `gateway_api` | `specs/001-fundamental-analysis-platform/contracts/openapi.yaml#/paths` |
| `AUTH-019` | `gateway_problems` | `specs/001-fundamental-analysis-platform/definitions/gateway-problem-details-catalog.json#/operationMatrix` |
| `AUTH-020` | `local_issues` | `specs/001-fundamental-analysis-platform/definitions/local-operation-issue-catalog.json#/issues` |
| `AUTH-021` | `acceptance` | `specs/001-fundamental-analysis-platform/definitions/acceptance-criteria-catalog.json#/criteria` |
| `AUTH-022` | `source_policy` | `specs/001-fundamental-analysis-platform/governance/source-policy-matrix.md#active-source-policy` |
| `AUTH-023` | `market_profiles` | `specs/001-fundamental-analysis-platform/governance/market-source-profile-register.md#profile-register` |
| `AUTH-024` | `replacement_deferral` | `specs/001-fundamental-analysis-platform/governance/replacement-and-deferral-register.json#/entries` |
| `AUTH-025` | `phase_gate` | `V0.21_PHASE_STATUS.md#gate` |
| `AUTH-026` | `decimal_arithmetic` | `specs/001-fundamental-analysis-platform/decisions/decimal-library.md` |
| `AUTH-027` | `ui_framework` | `specs/001-fundamental-analysis-platform/decisions/ui-framework.md` |
| `AUTH-028` | `formula_definitions` | `specs/001-fundamental-analysis-platform/definitions/formula-catalog.json#/formulas` |
| `AUTH-029` | `cache_refresh` | `specs/001-fundamental-analysis-platform/contracts/cache-and-refresh-policy.json` |
| `AUTH-030` | `sec_fact_selection` | `specs/001-fundamental-analysis-platform/contracts/sec-filing-fact-selection-policy.json` |
| `AUTH-031` | `security_input_limits` | `specs/001-fundamental-analysis-platform/contracts/security-and-input-limits.json` |
| `AUTH-032` | `accessibility` | `specs/001-fundamental-analysis-platform/definitions/wcag-2.2-aa-matrix.json#/criteria` |
| `AUTH-033` | `local_export_restore` | `specs/001-fundamental-analysis-platform/contracts/local-export-restore-contract.json` |
| `AUTH-034` | `requirements_traceability` | `specs/001-fundamental-analysis-platform/governance/requirements-acceptance-traceability.json` |
| `AUTH-035` | `cloudflare_free_budget` | `specs/001-fundamental-analysis-platform/governance/cloudflare-free-budget.json` |

## Autoridad de tareas v0.21

`specs/001-fundamental-analysis-platform/tasks.md` es la autoridad ejecutable de la fase de tareas y se subordina a constitución, spec, aclaraciones y plan.
