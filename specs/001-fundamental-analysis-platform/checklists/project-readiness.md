# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Checklist principal — Preparación para tareas

**Propósito**: Evaluar coherencia constitucional, completitud funcional, consistencia documental, testabilidad y gobierno de fase.
**Creado**: 2026-07-20
**Feature**: [001-fundamental-analysis-platform](../spec.md)
**Fase**: checklist

> **Convención de evaluación**
>
> - `[x]` = control aprobado o no aplicable con justificación.
> - `[ ]` = control con hallazgo abierto.
> - Severidades: `Bloqueante`, `Importante`, `Menor`, `Aprobado`, `No aplicable`.
> - Los ítems evalúan la calidad de requisitos y planificación; no son tareas de implementación.

## Coherencia constitucional

- [x] CHK001 ¿La especificación mantiene adquisición bajo demanda, procesamiento browser-first, D1 mínimo e IndexedDB opcional sin introducir ingestión global? [Constitution §§III–V; spec.md §§PS, CR-SUS; plan.md §§AD-001–AD-004] — **Resultado: Aprobado** (`A-003`)
- [x] CHK002 ¿La separación entre análisis informativo y asesoramiento personalizado está definida de manera inequívoca en alcance, requisitos e insights? [Constitution §VI; spec.md §§PS-002, FR-INS-007, SC-018] — **Resultado: Aprobado** (`A-004`)
- [x] CHK003 ¿La arquitectura evita una dependencia obligatoria de servicios pagos y conserva CSV/manual como modos de primer nivel? [Constitution §§III–IV; spec.md §§FR-SRC-001, CR-SUS-001–008; research.md Decisions 1, 13] — **Resultado: Aprobado** (`A-002`)
- [ ] CHK004 ¿La aplicabilidad jurídica y contractual del uso de cada proveedor personal desde una aplicación pública está resuelta mediante una matriz vigente y una decisión habilitar/deshabilitar por adaptador? [Constitution §III; spec.md §CR-LIC; research.md Decisions 1, 7; provider-adapter.md §2] — **Resultado: Bloqueante** (`H-B01`)
- [ ] CHK005 ¿Las reglas “solo gratuito” están expresadas como umbrales operativos verificables y revisables, sin prometer permanencia de planes de terceros? [Constitution §IV; spec.md §CR-SUS; research.md Decision 13] — **Resultado: Importante** (`H-I01`)
- [ ] CHK006 ¿El presupuesto constitucional de solicitudes, CPU, D1 y almacenamiento está asignado a cada flujo crítico con criterios de rechazo y degradación observables? [Constitution §IV; plan.md §§Technical Context, Risk Register; research.md Decision 13] — **Resultado: Importante** (`H-I02`)
## Alcance funcional

- [ ] CHK007 ¿Está definida la diferencia observable entre instrumento visible, cotizable, identificable por SEC, analizable fundamentalmente y apto para valuación/insights? [spec.md §§FR-CAT-003–008, FR-DQ-002; data-model.md §§3.1–3.2] — **Resultado: Bloqueante** (`H-B04`)
- [ ] CHK008 ¿La búsqueda externa posterior a una acción explícita tiene contrato de entrada, salida, confirmación de identidad, errores y política de proveedor? [spec.md §FR-CAT-007; provider-adapter.md §§2–4; openapi.yaml] — **Resultado: Bloqueante** (`H-B05`)
- [ ] CHK009 ¿Los tres modos de precio —API personal, CSV y manual— tienen capacidades, límites y resultados equivalentes claramente delimitados? [spec.md §§US02–US04, FR-SRC, FR-IMP; provider-adapter.md §§7–10] — **Resultado: Bloqueante** (`H-B07`)
- [ ] CHK010 ¿El análisis rápido define de manera normativa qué estadísticas produce, con qué serie, ventana, fórmula y degradación? [spec.md §§FR-MKT-004–012; analysis-pipeline.md §6] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK011 ¿El análisis fundamental define entradas, normalización, KPI aplicables y salida insuficiente sin depender de decisiones futuras no documentadas? [spec.md §§US05–US06, FR-FIN, FR-KPI; data-model.md §§3.9–3.13] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK012 ¿El análisis integral define condiciones de compatibilidad temporal, monetaria, de identidad, acciones y ADR antes de calcular valuación? [spec.md §FR-VAL; analysis-pipeline.md §8; data-model.md §3.14] — **Resultado: Bloqueante** (`H-B11`)
- [ ] CHK013 ¿La generación de insights dispone de reglas, umbrales, precedencia, confianza y salida insuficiente normativas? [spec.md §FR-INS; data-model.md §§3.15–3.16; analysis-pipeline.md §9] — **Resultado: Bloqueante** (`H-B03`)
## Estados y degradación

- [x] CHK014 ¿Los estados de cuota agotada, proveedor caído, símbolo inexistente, mercado no autorizado y error temporal están diferenciados y tienen recuperación definida? [spec.md §§FR-SRC-006, Edge Cases; provider-adapter.md §6; quickstart.md Scenarios B–D] — **Resultado: Aprobado** (`A-007`)
- [ ] CHK015 ¿La frescura de catálogo, precio, fundamentales, definiciones y cachés tiene umbrales normativos y no solo “configurables”? [spec.md §§FR-DQ-004, FR-LOC-004; browser-storage.md §5; research.md Decisions 9–10] — **Resultado: Bloqueante** (`H-B11`)
- [ ] CHK016 ¿La política de caché válida, caché vencida, stale-while-error y último resultado local válido es consistente entre requisitos, contratos y quickstart? [spec.md §§FR-DQ-008, CR-SUS-006; browser-storage.md §5; quickstart.md §§9, 12] — **Resultado: Importante** (`H-I06`)
## Consistencia documental

- [ ] CHK017 ¿Los vocabularios de cobertura y estado coinciden en spec, modelo, OpenAPI, almacenamiento y UI? [spec.md §§FR-CAT-005, FR-DQ-002–003; data-model.md §3.2; openapi.yaml CoverageSummary/CoverageState] — **Resultado: Bloqueante** (`H-B04`)
- [ ] CHK018 ¿El transporte de credenciales personales tiene una única regla canónica entre spec, plan, research, adaptador y OpenAPI? [spec.md §FR-SRC-002; plan.md §AD-001; research.md Decision 8; provider-adapter.md §3; openapi.yaml /market-series] — **Resultado: Bloqueante** (`H-B06`)
- [ ] CHK019 ¿La entrada manual exige el mismo conjunto mínimo de campos en todos los documentos? [spec.md §FR-IMP-005; data-model.md §3.7; provider-adapter.md §10; quickstart.md Scenario C] — **Resultado: Bloqueante** (`H-B07`)
- [ ] CHK020 ¿Las restricciones de valores, moneda, precisión y plantillas obligatorias coinciden entre modelo y OpenAPI? [data-model.md §§3.5–3.6, 3.12, 3.15; openapi.yaml schemas] — **Resultado: Bloqueante** (`H-B08`)
- [ ] CHK021 ¿La decisión de framework HTTP, librería gráfica o alternativa nativa está cerrada para que tareas no deban inventar dependencias? [plan.md §Technical Context; §Project Structure] — **Resultado: Bloqueante** (`H-B14`)
## Testabilidad

- [ ] CHK022 ¿Cada KPI y múltiplo tiene tolerancia numérica, reglas de redondeo y fixture de referencia suficientes para un oráculo objetivo? [spec.md §§FR-KPI, FR-VAL, SC-011–017; quickstart.md §§9–11] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK023 ¿El objetivo de ≤2 s identifica hardware/navegador, carga, método de medición, percentil y margen de variabilidad? [spec.md §§QR-PERF, SC-027; plan.md §Technical Context; analysis-pipeline.md §12] — **Resultado: Bloqueante** (`H-B12`)
- [ ] CHK024 ¿Los criterios de éxito evitan términos subjetivos sin definición, como “completo”, “preciso”, “intuitivo” o “dispositivo acordado”? [spec.md §§Observable Product Quality, SC-027–030] — **Resultado: Bloqueante** (`H-B12`)
## Gobierno de fase

- [x] CHK025 ¿El baseline original permanece intacto y su manifest verifica todos los archivos declarados? [START_HERE_CHATGPT.md; FILE_MANIFEST.sha256; CHECKLIST_EXECUTION_REPORT.md] — **Resultado: Aprobado** (`A-001`)
- [x] CHK026 ¿La fase produce únicamente controles e informes, sin tasks.md, código, dependencias, builds ni cambios en .specify? [Constitution §X; specdev-prompts/speckit.checklist.md; CHECKLIST_EXECUTION_REPORT.md] — **Resultado: Aprobado** (`A-008`)
- [x] CHK027 ¿Los hallazgos materiales se registran sin corregir silenciosamente constitución, especificación, plan, modelo o contratos? [Instrucción de fase; CHECKLIST_FINDINGS_MATRIX.md] — **Resultado: Aprobado** (`A-011`)
- [x] CHK028 ¿El estado de salida impide avanzar a tareas mientras haya contradicciones materiales abiertas? [Constitution §X; CHECKLIST_BLOCKERS.md] — **Resultado: Aprobado** (`A-012`)

## Notas

- Los hallazgos consolidados se encuentran en [`../CHECKLIST_FINDINGS_MATRIX.md`](../CHECKLIST_FINDINGS_MATRIX.md).
- Los bloqueantes se encuentran en [`../CHECKLIST_BLOCKERS.md`](../CHECKLIST_BLOCKERS.md).
- El dictamen de fase se encuentra en [`../CHECKLIST_EXECUTION_REPORT.md`](../CHECKLIST_EXECUTION_REPORT.md).
