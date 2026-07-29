# Informe de control de calidad — v0.8

**Fecha:** 2026-07-20  
**Resultado documental y de manifest:** `82/82` controles aprobados, `0` fallidos.  
**Alcance:** integridad del baseline, Spec Kit, estructura documental, OpenAPI, contratos, fórmulas, enums, seguridad, trazabilidad, manifest y ausencia de artefactos prohibidos.

## Síntesis

- El ZIP físico v0.7 conserva el SHA-256 original `1a9113cf3b742cb23708166f735e7f2906233b158792617298f9cac261507ee2`.
- `.specify` y `specdev-prompts` son byte a byte idénticos al baseline.
- No existe `tasks.md`, código de producto, SQL, builds, dependencias, archivos temporales ni ZIP anidado.
- OpenAPI 3.1 parsea correctamente; sus referencias locales resuelven y contiene únicamente seis paths del gateway MVP.
- El catálogo cerrado contiene 36 métricas; las 36 fórmulas normativas y 36 oráculos numéricos independientes validan dentro de tolerancia.
- Las 12 reglas de insights contienen los 16 campos normativos y aplican la confianza 35/25/20/20.
- Los 29 hallazgos v0.7 tienen trazabilidad de decisión y estado documental `resolved`.
- El manifest enumera exactamente 63 archivos distintos del propio manifest y todos sus hashes son válidos.
- No se detectaron secretos, tokens ni claves reales.

## Correspondencia con el control solicitado

1. Baseline original intacto: aprobado.
2. Ausencia de `tasks.md`: aprobado.
3. Ausencia de código de producto: aprobado.
4. Ausencia de builds/cachés: aprobado.
5. Ausencia de dependencias instaladas o manifests: aprobado.
6. `.specify` intacto: aprobado.
7. OpenAPI: YAML válido, paths/refs/schemas controlados.
8. Referencias internas: enlaces relativos y refs OpenAPI resueltos.
9. Identificadores duplicados: ninguno en requisitos, aceptación, métricas, insights, ADR o hallazgos.
10. Enums: cobertura canónica exacta.
11. Entidades: identidad, política, serie, trazabilidad y persistencia alineadas.
12. Estados y errores: vocabulario y recuperación validados.
13. Fórmulas financieras: catálogo completo y oráculos independientes.
14. Bloqueantes: 14/14 trazados.
15. Importantes y menores: 12/12 y 3/3 trazados.
16. Secretos: ninguno detectado.
17. Temporales: ninguno detectado.
18. Manifest: 63 entradas exactas y hashes válidos.
19. CRC del ZIP: se valida después de crear el archivo final mediante `unzip -t`.
20. SHA-256 del ZIP: se entrega como sidecar externo; no puede auto-incluirse sin alterar el hash del propio ZIP.

## Detalle de controles documental y de manifest

| Control | Estado | Evidencia |
|---|---|---|
| `baseline_physical_zip_unchanged` | `PASS` | 1a9113cf3b742cb23708166f735e7f2906233b158792617298f9cac261507ee2 |
| `root_name_logical_without_suffix` | `PASS` | FinScope_Analytics_SpecDev_ChatGPT_v0.8_remediation |
| `.specify_unchanged` | `PASS` | 19 files byte-identical |
| `specdev-prompts_unchanged` | `PASS` | 10 files byte-identical |
| `no_tasks_md` | `PASS` | no tasks.md |
| `no_node_modules` | `PASS` | absent |
| `no_dist` | `PASS` | absent |
| `no_build` | `PASS` | absent |
| `no_cache` | `PASS` | absent |
| `no_vite` | `PASS` | absent |
| `no_coverage` | `PASS` | absent |
| `no___pycache__` | `PASS` | absent |
| `no_nested_archives` | `PASS` | absent |
| `no_product_code_or_sql` | `PASS` | only documentary/infrastructure files |
| `no_dependency_manifests` | `PASS` | absent |
| `no_temp_files` | `PASS` | absent |
| `required_documents_present` | `PASS` | 26 required docs present |
| `historical_checklists_marked` | `PASS` | 8 historical files marked |
| `markdown_relative_links_resolve` | `PASS` | all relative Markdown links resolve |
| `openapi_version` | `PASS` | 3.1.0 |
| `openapi_paths_exact_mvp` | `PASS` | ['/health', '/market-series', '/sec/companies/{cik}/concepts/{taxonomy}/{concept}', '/sec/companies/{cik}/facts', '/sec/companies/{cik}/submissions', '/source-policies'] |
| `openapi_no_admin_paths` | `PASS` | none |
| `openapi_no_external_symbol_search` | `PASS` | none |
| `openapi_local_refs_resolve` | `PASS` | 21 refs resolve |
| `openapi_cik_pattern` | `PASS` | canonical 10 digits |
| `openapi_credential_write_only` | `PASS` | writeOnly and required |
| `openapi_policy_gated_market` | `PASS` | true |
| `openapi_abort_extensions` | `PASS` | all upstream operations |
| `openapi_local_contract_extensions` | `PASS` | present |
| `openapi_source_policy_fields` | `PASS` | all required policy fields |
| `openapi_market_metadata` | `PASS` | canonical metadata required |
| `openapi_prices_volume_constraints` | `PASS` | close>0; volume>=0 |
| `openapi_instrument_identity_fields` | `PASS` | identity complete |
| `coverage_enum_openapi` | `PASS` | ['complete', 'partial', 'unavailable', 'unsupported', 'not_applicable', 'stale', 'blocked_by_policy'] |
| `coverage_enum_data_model` | `PASS` | exact vocabulary |
| `coverage_dimensions` | `PASS` | five dimensions |
| `source_policy_provider_rows` | `PASS` | ['alpha-vantage', 'csv-user', 'manual-user', 'sec-edgar', 'twelve-data'] |
| `twelve-data_disabled_policy` | `PASS` | conditional_unverified enabled=false |
| `alpha-vantage_disabled_policy` | `PASS` | conditional_unverified enabled=false |
| `provider_review_max_90_days` | `PASS` | 90 days |
| `credential_transport_policy` | `PASS` | explicit |
| `metric_catalog_closed_set` | `PASS` | 36 unique metrics |
| `metric_entries_all_fields` | `PASS` | all fields in 36 metrics |
| `metric_confidence_vocab` | `PASS` | low/medium/high only |
| `dividend_yield_not_metric` | `PASS` | explicitly out |
| `adjustment_metric_matrix` | `PASS` | explicit |
| `formula_catalog_strings` | `PASS` | 36 formulas matched |
| `independent_formula_oracles` | `PASS` | 36 numerical oracles passed |
| `confidence_classification_oracle` | `PASS` | 0.78=medium |
| `insight_rule_ids` | `PASS` | ['INS-001', 'INS-002', 'INS-003', 'INS-004', 'INS-005', 'INS-006', 'INS-007', 'INS-008', 'INS-009', 'INS-010', 'INS-011', 'INS-012'] |
| `insight_entries_all_fields` | `PASS` | all 16 fields in 12 rules |
| `confidence_formula_weights` | `PASS` | 35/25/20/20 |
| `confidence_thresholds` | `PASS` | exact thresholds |
| `mixed_rule_present` | `PASS` | mixed deterministic |
| `no_advice_rules` | `PASS` | prohibitions present |
| `xbrl_rules_complete` | `PASS` | mapping rules complete |
| `manual_contract_fields` | `PASS` | required/optional aligned |
| `csv_contract_complete` | `PASS` | CSV controls present |
| `partial_state_matrix_complete` | `PASS` | 10 states |
| `http_security_requirements` | `PASS` | security contract present |
| `browser_first_boundary` | `PASS` | layers named |
| `worker_no_financial_processing` | `PASS` | explicit |
| `d1_not_critical` | `PASS` | explicit |
| `admin_remote_removed` | `PASS` | removed |
| `local_search_zero_requests` | `PASS` | explicit |
| `hono_zod_svg_table` | `PASS` | closed |
| `no_graph_library` | `PASS` | explicit |
| `functional_requirement_ids_unique` | `PASS` | 84 unique |
| `quality_requirement_ids_unique` | `PASS` | 8 unique |
| `acceptance_case_ids_unique` | `PASS` | 36 unique |
| `adr_ids_unique` | `PASS` | 12 unique |
| `acceptance_matrix_required_cases` | `PASS` | 33 cases |
| `all_29_findings_traced` | `PASS` | 29 findings / 29 resolved |
| `no_residual_blockers` | `PASS` | none documented |
| `canonical_glossary_complete` | `PASS` | 17 canonical terms |
| `allowed_exit_status` | `PASS` | exact status |
| `not_approved_for_tasks` | `PASS` | forbidden statuses absent |
| `no_secrets_tokens_keys` | `PASS` | no secret-like values |
| `no_invented_product_structure` | `PASS` | deferred to post-checklist |
| `manifest_exists` | `PASS` | present |
| `manifest_entries_exact` | `PASS` | 63 entries |
| `manifest_hashes_valid` | `PASS` | all hashes valid |

## Dictamen

`CORRECCIÓN DOCUMENTAL COMPLETADA — LISTO PARA REPETIR CHECKLIST`

Este informe no sustituye la repetición formal del checklist ni habilita `tasks.md`. La integridad del archivo ZIP y su SHA-256 se verifican externamente después de empaquetar.
