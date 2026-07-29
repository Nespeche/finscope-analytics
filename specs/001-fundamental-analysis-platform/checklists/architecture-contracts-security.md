# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Checklist especializado — Arquitectura, contratos y seguridad

**Propósito**: Evaluar fronteras técnicas, OpenAPI, adaptadores, Web Worker, IndexedDB, D1, seguridad, administración y sustentabilidad.
**Creado**: 2026-07-20
**Feature**: [001-fundamental-analysis-platform](../spec.md)
**Fase**: checklist

> **Convención de evaluación**
>
> - `[x]` = control aprobado o no aplicable con justificación.
> - `[ ]` = control con hallazgo abierto.
> - Severidades: `Bloqueante`, `Importante`, `Menor`, `Aprobado`, `No aplicable`.
> - Los ítems evalúan la calidad de requisitos y planificación; no son tareas de implementación.

## Distribución de responsabilidades

- [x] CHK001 ¿Frontend, Web Worker, gateway, D1 e IndexedDB tienen fronteras coherentes y sin cálculo intensivo duplicado? [plan.md §§Project Structure, AD-002–AD-004; analysis-pipeline.md §§2–5] — **Resultado: Aprobado** (`A-003`)
- [x] CHK002 ¿El flujo no realiza ingestión global diaria ni almacena universalmente market data/Company Facts? [constitution.md §§IV–V; research.md Decisions 3, 5; plan.md §AD-004] — **Resultado: Aprobado** (`A-003`)
- [x] CHK003 ¿El gateway personal normaliza solo el envelope y no conserva credencial o respuesta? [plan.md §AD-001; provider-adapter.md §§3–5] — **Resultado: Aprobado** (`A-014`)
- [ ] CHK004 ¿La opción “Hono o equivalente” está resuelta o acotada por criterios verificables antes de tareas? [plan.md §Technical Context] — **Resultado: Bloqueante** (`H-B14`)
- [ ] CHK005 ¿La visualización usa una decisión de dependencia accesible/tamaño o una alternativa nativa concreta? [plan.md §Technical Context] — **Resultado: Importante** (`H-I09`)
## OpenAPI

- [x] CHK006 ¿OpenAPI 3.1 es sintácticamente válido y todos los $ref internos resuelven? [contracts/openapi.yaml; CHECKLIST_EXECUTION_REPORT.md] — **Resultado: Aprobado** (`A-015`)
- [ ] CHK007 ¿CoverageSummary incluye identidad, mercado, fundamentales, valuación e insights como exige la constitución? [constitution.md §VII; spec.md §FR-DQ-002; openapi.yaml CoverageSummary] — **Resultado: Bloqueante** (`H-B04`)
- [ ] CHK008 ¿Existe contrato para búsqueda externa de símbolos cuando supportsSymbolSearch=true? [spec.md §FR-CAT-007; provider-adapter.md §§2, 4; openapi.yaml] — **Resultado: Bloqueante** (`H-B05`)
- [ ] CHK009 ¿Los esquemas de precios impiden valores negativos y exigen moneda donde el modelo la considera obligatoria? [data-model.md §§3.5–3.6; openapi.yaml MarketObservation/ProviderEnvelope] — **Resultado: Bloqueante** (`H-B08`)
- [ ] CHK010 ¿MetricDefinition exige precisión y InsightRuleDefinition exige limitaciones como el modelo? [data-model.md §§3.12, 3.15; openapi.yaml schemas] — **Resultado: Bloqueante** (`H-B08`)
- [ ] CHK011 ¿Los estados de cobertura tienen un vocabulario y mapeo único con Instrument.marketCoverage? [data-model.md §3.2; openapi.yaml CoverageState] — **Resultado: Bloqueante** (`H-B04`)
- [ ] CHK012 ¿Los errores canónicos cubren cuota, símbolo, mercado, política, stale, cancelación y payload inválido con recuperación? [spec.md §FR-SRC-006; provider-adapter.md §6; openapi.yaml ErrorEnvelope] — **Resultado: Importante** (`H-I06`)
- [ ] CHK013 ¿Las respuestas SEC tienen límites, compresión, timeout y error de payload excesivo? [openapi.yaml SEC paths; plan.md §AD-002] — **Resultado: Importante** (`H-I04`)
## Adaptadores

- [ ] CHK014 ¿La interfaz cubre todas las capacidades declaradas, incluida búsqueda de símbolos? [provider-adapter.md §§2–4] — **Resultado: Bloqueante** (`H-B05`)
- [ ] CHK015 ¿Las políticas de adjusted/raw y outputsize se corresponden con capacidades gratuitas vigentes? [provider-adapter.md §§2, 7–8; SourcePolicy] — **Resultado: Bloqueante** (`H-B10`)
## Web Worker

- [x] CHK016 ¿Los mensajes UI→Worker y eventos Worker→UI definen IDs, versiones, progreso, cancelación y error sanitizado? [analysis-pipeline.md §§3–4, 11] — **Resultado: Aprobado** (`A-016`)
- [ ] CHK017 ¿El progreso tiene frecuencia/etapas y la cancelación tiene un estado terminal único? [analysis-pipeline.md §§4, 12; spec.md §FR-SRC-009] — **Resultado: Importante** (`H-I08`)
- [ ] CHK018 ¿Los límites de facts/series y memoria están definidos para evitar arrays duplicados y exceder 128 MB? [analysis-pipeline.md §12; plan.md §Technical Context] — **Resultado: Importante** (`H-I02`)
## IndexedDB

- [x] CHK019 ¿El nombre, versión, stores, claves e índices están definidos y migran sin perder snapshots compatibles? [data-model.md §§5, 9; browser-storage.md §§2–3] — **Resultado: Aprobado** (`A-009`)
- [ ] CHK020 ¿Frescura, expiración, quota, eviction y eliminación tienen umbrales concretos y orden determinístico? [browser-storage.md §§5–6; data-model.md §7] — **Resultado: Importante** (`H-I10`)
- [ ] CHK021 ¿Borrar por instrumento/tipo/todo exige confirmación y comunica alcance irreversible? [spec.md §FR-LOC-003; browser-storage.md §§6, 8] — **Resultado: Importante** (`H-I10`)
- [ ] CHK022 ¿Exportación/importación define versión, hash, tamaño máximo, duplicados, migración y rechazo atómico? [browser-storage.md §§7–8] — **Resultado: Importante** (`H-I10`)
## D1 y caché

- [x] CHK023 ¿D1 contiene solo catálogo, políticas, definiciones, auditoría, uso y snapshots autorizados? [research.md Decision 5; data-model.md §4; plan.md §AD-004] — **Resultado: Aprobado** (`A-003`)
- [ ] CHK024 ¿La clave de caché incluye empresa/CIK, fecha, parámetros, ETag y versión de normalización cuando corresponde? [research.md Decisions 3, 5; data-model.md §§3.9, 4] — **Resultado: Importante** (`H-I02`)
- [ ] CHK025 ¿La retención mínima y la eliminación de cachés temporales están cuantificadas? [data-model.md §7; research.md Decisions 3, 5] — **Resultado: Importante** (`H-I10`)
## Seguridad

- [x] CHK026 ¿Las claves personales no se persisten, no se envían a D1 y no aparecen en URL, logs, errores o fingerprints? [constitution.md §VII; spec.md §CR-SEC; provider-adapter.md §3] — **Resultado: Aprobado** (`A-014`)
- [ ] CHK027 ¿CORS, CSP, Referrer-Policy, timeouts y allowlists de host/método están definidos para el gateway? [spec.md §CR-SEC; plan.md §AD-001; openapi.yaml] — **Resultado: Importante** (`H-I11`)
- [x] CHK028 ¿Los errores externos eliminan payloads crudos y datos sensibles sin impedir diagnóstico por código? [spec.md §CR-SEC-007; provider-adapter.md §6; analysis-pipeline.md §11] — **Resultado: Aprobado** (`A-014`)
- [ ] CHK029 ¿La autenticación HMAC define algoritmo, canonicalización, skew, nonce TTL, replay store y rotación? [openapi.yaml AdminHmac; data-model.md §4.11] — **Resultado: Importante** (`H-I12`)
## Administración

- [ ] CHK030 ¿La publicación atómica define staging, validación, promoción, rollback y preservación de versión anterior? [spec.md §§FR-ADM-003–004; quickstart.md Scenario I; openapi.yaml admin paths] — **Resultado: Importante** (`H-I12`)
- [ ] CHK031 ¿La autorización de snapshots públicos demuestra permiso de display por fuente y campo? [spec.md §FR-ADM-003; data-model.md §3.19] — **Resultado: Importante** (`H-I12`)
## Sustentabilidad

- [x] CHK032 ¿Los límites internos son inferiores a límites actuales de Cloudflare Workers/D1 y tienen margen documentado? [constitution.md §IV; research.md Decision 13] — **Resultado: Aprobado** (`A-006`)
- [x] CHK033 ¿La cuota externa se contabiliza por usuario/proveedor y se evita convertir un límite personal en servicio compartido? [spec.md §CR-SUS; provider-adapter.md §2] — **Resultado: Aprobado** (`A-006`)
- [x] CHK034 ¿El mecanismo de cambio de proveedor depende de contratos canónicos y SourcePolicy, no de lógica UI específica? [research.md Decision 7; provider-adapter.md; plan.md §AD-005] — **Resultado: Aprobado** (`A-017`)

## Notas

- Los hallazgos consolidados se encuentran en [`../CHECKLIST_FINDINGS_MATRIX.md`](../CHECKLIST_FINDINGS_MATRIX.md).
- Los bloqueantes se encuentran en [`../CHECKLIST_BLOCKERS.md`](../CHECKLIST_BLOCKERS.md).
- El dictamen de fase se encuentra en [`../CHECKLIST_EXECUTION_REPORT.md`](../CHECKLIST_EXECUTION_REPORT.md).
