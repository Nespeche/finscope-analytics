# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Checklist especializado — UX, accesibilidad y testabilidad

**Propósito**: Evaluar transparencia, progreso, cancelación, errores, privacidad local, WCAG 2.2 AA y criterios observables.
**Creado**: 2026-07-20
**Feature**: [001-fundamental-analysis-platform](../spec.md)
**Fase**: checklist

> **Convención de evaluación**
>
> - `[x]` = control aprobado o no aplicable con justificación.
> - `[ ]` = control con hallazgo abierto.
> - Severidades: `Bloqueante`, `Importante`, `Menor`, `Aprobado`, `No aplicable`.
> - Los ítems evalúan la calidad de requisitos y planificación; no son tareas de implementación.

## Flujo y transparencia

- [ ] CHK001 ¿Los botones de análisis rápido, fundamental, valuación e integral tienen nombres y prerequisitos consistentes en todos los documentos? [spec.md §§US03, US05–US08, FR-INS-006; quickstart.md] — **Resultado: Importante** (`H-I09`)
- [ ] CHK002 ¿La diferencia entre “Analizar fundamentales” y “Analizar estados contables” está resuelta en una terminología única? [spec.md §§US05–US06; PROJECT_CONTEXT.md] — **Resultado: Menor** (`H-M03`)
- [x] CHK003 ¿Cada resultado muestra fuente, fecha, moneda, período, fórmula, cobertura, confianza y limitaciones? [spec.md §§FR-MKT-010, FR-KPI-003, FR-INS-003, FR-DQ] — **Resultado: Aprobado** (`A-018`)
- [ ] CHK004 ¿El estado de frescura diferencia vigente, desactualizado, caché vencida y último válido tras fallo? [spec.md §§FR-DQ-003–008; browser-storage.md §5] — **Resultado: Importante** (`H-I06`)
- [x] CHK005 ¿El usuario puede comprender por qué un KPI está no disponible, no aplicable, no significativo o no comparable? [spec.md §§FR-KPI-004–006, FR-VAL-007; analysis-pipeline.md §11] — **Resultado: Aprobado** (`A-018`)
## Progreso y cancelación

- [ ] CHK006 ¿Cada proceso bajo demanda muestra etapas de progreso con texto accesible y estado terminal? [spec.md §§FR-SRC-009, QR-UX; analysis-pipeline.md §§3–4] — **Resultado: Importante** (`H-I08`)
- [ ] CHK007 ¿Cancelar distingue cancelado por usuario, reemplazado por nueva sesión y fallo externo? [analysis-pipeline.md §§4, 11–12; quickstart.md Scenario D] — **Resultado: Importante** (`H-I08`)
- [ ] CHK008 ¿La cancelación preserva el último resultado local válido sin confundirlo con el intento cancelado? [spec.md §FR-DQ-008; analysis-pipeline.md §11] — **Resultado: Importante** (`H-I08`)
## Errores y vacíos

- [x] CHK009 ¿Existen mensajes accionables para ticker inexistente, mercado no autorizado, cuota agotada, proveedor caído y clave inválida? [spec.md §§FR-SRC-006, Edge Cases; provider-adapter.md §6] — **Resultado: Aprobado** (`A-019`)
- [x] CHK010 ¿El estado sin datos explica qué capa puede seguir funcionando y ofrece API/CSV/manual según corresponda? [spec.md §§FR-FIN-011, FR-SRC-001; quickstart.md] — **Resultado: Aprobado** (`A-007`)
- [ ] CHK011 ¿La moneda incompatible y el precio desactualizado muestran causa, fecha y acción de recuperación? [spec.md §§FR-VAL-006–007, FR-DQ-004; quickstart.md Scenario F] — **Resultado: Importante** (`H-I06`)
## Accesibilidad

- [ ] CHK012 ¿Los criterios WCAG 2.2 AA cubren navegación por teclado, orden de foco, foco visible y ausencia de trampas? [constitution.md §VIII; spec.md §§US12, QR-UX] — **Resultado: Importante** (`H-I05`)
- [ ] CHK013 ¿Los gráficos tienen alternativa textual, nombre accesible, datos tabulares y no dependen solo del color? [spec.md §§US12, QR-UX; plan.md §Technical Context] — **Resultado: Importante** (`H-I05`)
- [x] CHK014 ¿Tooltips y explicaciones KPI son accesibles mediante foco/control persistente y lectores de pantalla? [spec.md §AC-US12-04; QR-UX] — **Resultado: Aprobado** (`A-020`)
- [ ] CHK015 ¿Los cambios de progreso, error y resultado se anuncian mediante regiones vivas sin ruido excesivo? [spec.md §§US12, QR-UX; analysis-pipeline.md §4] — **Resultado: Importante** (`H-I05`)
- [ ] CHK016 ¿El contraste se define contra WCAG AA para texto, controles, gráficos y estados? [constitution.md §VIII; spec.md §QR-UX] — **Resultado: Importante** (`H-I05`)
- [ ] CHK017 ¿La experiencia responsive define tamaños/touch targets y no depende de hover? [spec.md §§US12, QR-UX] — **Resultado: Importante** (`H-I05`)
## Privacidad local

- [ ] CHK018 ¿El consentimiento para guardar distingue settings, market data, fundamentales y snapshots? [spec.md §FR-LOC; browser-storage.md §4] — **Resultado: Importante** (`H-I10`)
- [x] CHK019 ¿La API key se presenta como efímera y la UI no ofrece persistencia accidental/autocompletado inseguro? [spec.md §§FR-SRC-003, CR-SEC; provider-adapter.md §3] — **Resultado: Aprobado** (`A-014`)
- [ ] CHK020 ¿Eliminar datos personales exige confirmación, identifica alcance y confirma finalización? [spec.md §FR-LOC-003; browser-storage.md §6] — **Resultado: Importante** (`H-I10`)
## Testabilidad positiva

- [x] CHK021 ¿Existe un caso positivo observable para búsqueda local, API personal, CSV, manual, SEC, KPI, valuación e insights? [spec.md User Stories; quickstart.md Scenarios A–G] — **Resultado: Aprobado** (`A-021`)
## Testabilidad negativa

- [x] CHK022 ¿Existen casos para cuota agotada, proveedor caído, ticker inexistente, estados incompletos, moneda incompatible y KPI no aplicable? [spec.md Edge Cases; quickstart.md §§6–11] — **Resultado: Aprobado** (`A-021`)
## Testabilidad de caché

- [ ] CHK023 ¿Caché válida, caché vencida, ETag/304 y stale tras fallo tienen resultados esperados medibles? [research.md Decision 3; browser-storage.md §5; quickstart.md Scenarios E, H] — **Resultado: Importante** (`H-I06`)
## Testabilidad de cancelación

- [ ] CHK024 ¿La cancelación puede observarse en UI, Worker, gateway y limpieza de credencial? [spec.md §FR-SRC-009; provider-adapter.md §11; analysis-pipeline.md §§3–4] — **Resultado: Importante** (`H-I08`)
## Testabilidad numérica

- [ ] CHK025 ¿Las fixtures fijan moneda, timezone, versión, redondeo y tolerancia para evitar falsos positivos? [research.md Decision 12; analysis-pipeline.md §§10, 13; quickstart.md] — **Resultado: Bloqueante** (`H-B12`)
## Testabilidad de rendimiento

- [ ] CHK026 ¿La prueba de 500 observaciones define dispositivo, navegador, warm-up, repeticiones y percentil? [spec.md §SC-027; analysis-pipeline.md §12; quickstart.md §14] — **Resultado: Bloqueante** (`H-B12`)
## Testabilidad de seguridad

- [x] CHK027 ¿Los canarios verifican ausencia de API key en logs, URL, D1, IndexedDB, errores, exportaciones y telemetría? [spec.md §SC-023; provider-adapter.md §11; browser-storage.md §9] — **Resultado: Aprobado** (`A-014`)
## Testabilidad de licencias

- [ ] CHK028 ¿Cada adaptador tiene prueba de política vigente, disabled-by-default y degradación a CSV/manual? [data-model.md §3.4; provider-adapter.md §§2, 11] — **Resultado: Importante** (`H-I01`)
## Operación gratuita

- [x] CHK029 ¿La CI pública y actualización de catálogo tienen respaldo manual si un schedule se desactiva por inactividad? [spec.md §FR-ADM-005; research.md Decision 13] — **Resultado: Aprobado** (`A-022`)
- [ ] CHK030 ¿El producto comunica que los límites de terceros pueden cambiar y no promete disponibilidad continua? [spec.md §§CR-SUS, QR-REL; SourcePolicy] — **Resultado: Importante** (`H-I01`)
## Trazabilidad del baseline

- [ ] CHK031 ¿El nombre físico con sufijo `(1)` se distingue del identificador lógico v0.6 sin inferir otra versión? [START_HERE_CHATGPT.md; baseline ZIP metadata] — **Resultado: Menor** (`H-M01`)
## Salida de fase

- [x] CHK032 ¿La matriz y el registro de bloqueantes justifican de forma reproducible el estado NO APROBADO PARA TAREAS? [CHECKLIST_FINDINGS_MATRIX.md; CHECKLIST_BLOCKERS.md] — **Resultado: Aprobado** (`A-012`)

## Notas

- Los hallazgos consolidados se encuentran en [`../CHECKLIST_FINDINGS_MATRIX.md`](../CHECKLIST_FINDINGS_MATRIX.md).
- Los bloqueantes se encuentran en [`../CHECKLIST_BLOCKERS.md`](../CHECKLIST_BLOCKERS.md).
- El dictamen de fase se encuentra en [`../CHECKLIST_EXECUTION_REPORT.md`](../CHECKLIST_EXECUTION_REPORT.md).
