# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Checklist especializado — Fundamentales, KPI, valuación e insights

**Propósito**: Evaluar normalización SEC/XBRL, definiciones financieras, aplicabilidad sectorial, valuación, confianza y determinismo.
**Creado**: 2026-07-20
**Feature**: [001-fundamental-analysis-platform](../spec.md)
**Fase**: checklist

> **Convención de evaluación**
>
> - `[x]` = control aprobado o no aplicable con justificación.
> - `[ ]` = control con hallazgo abierto.
> - Severidades: `Bloqueante`, `Importante`, `Menor`, `Aprobado`, `No aplicable`.
> - Los ítems evalúan la calidad de requisitos y planificación; no son tareas de implementación.

## SEC e identidad

- [x] CHK001 ¿La obtención SEC exige acción explícita, CIK validado, User-Agent y límites compatibles con acceso justo? [spec.md §§FR-FIN-001–002; research.md Decision 3; openapi.yaml SEC paths] — **Resultado: Aprobado** (`A-005`)
- [ ] CHK002 ¿La resolución ticker→CIK y emisor→instrumento conserva versión de catálogo y conflictos históricos? [spec.md §§FR-CAT, FR-FIN-001; data-model.md §§3.1–3.3] — **Resultado: Bloqueante** (`H-B09`)
- [ ] CHK003 ¿El contrato define tamaño máximo, paginación o streaming para submissions/Company Facts voluminosos? [openapi.yaml SEC responses; plan.md §AD-002] — **Resultado: Importante** (`H-I04`)
## Normalización XBRL

- [ ] CHK004 ¿Existe un catálogo normativo de conceptos canónicos, aliases US-GAAP/IFRS y precedencia por perfil? [spec.md §FR-FIN-006; research.md Decision 3; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK005 ¿Unidades, escalas, signos y moneda se normalizan con reglas exactas y auditables? [spec.md §§FR-FIN-005, FR-FIN-009; data-model.md §3.10] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK006 ¿Los períodos instant, trimestre, YTD, anual y TTM tienen algoritmos de selección y compatibilidad completos? [spec.md §FR-FIN-004; data-model.md §§3.10–3.11; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK007 ¿Los trimestres derivados desde acumulados especifican fórmula, tolerancia, precedencia y bloqueo por solapamiento? [spec.md §FR-FIN-007; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK008 ¿Duplicados, amendments y restatements tienen reglas de versión vigente, historial y recálculo reproducible? [spec.md §FR-FIN-008; data-model.md §§3.9–3.10; analysis-pipeline.md §7] — **Resultado: Importante** (`H-I05`)
- [ ] CHK009 ¿La confianza de cada hecho se deriva mediante una escala y algoritmo definidos, no solo un campo? [spec.md §FR-FIN-006; data-model.md §§3.10, 3.13] — **Resultado: Bloqueante** (`H-B03`)
- [x] CHK010 ¿La trazabilidad llega hasta accession, form, filing date, period, taxonomy, tag y unit originales? [spec.md §FR-FIN-005; data-model.md §§3.9–3.10] — **Resultado: Aprobado** (`A-009`)
## Aplicabilidad sectorial

- [ ] CHK011 ¿Bancos, aseguradoras, REITs y otros perfiles tienen una matriz normativa de KPI aplicables/no aplicables? [spec.md §§FR-CAT-004, FR-KPI-005; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B13`)
- [ ] CHK012 ¿La exclusión temporal de métricas industriales para perfiles especiales está alineada con la promesa de análisis fundamental? [spec.md §§US06, FR-KPI; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B13`)
## Definiciones KPI

- [ ] CHK013 ¿Cada KPI P0 tiene definición, fórmula DSL, numerador, denominador, unidad, período, fuente, precisión y texto explicativo? [spec.md §§FR-KPI-001–003; data-model.md §3.12] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK014 ¿Ingresos y crecimiento definen base comparable, moneda, período y comportamiento con valores negativos? [spec.md §FR-KPI-001; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK015 ¿Margen bruto, operativo y neto definen componentes y tratamiento de ingresos cero/negativos? [spec.md §FR-KPI-001; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK016 ¿Caja, deuda, deuda neta y solvencia delimitan qué partidas se incluyen o excluyen? [spec.md §§FR-KPI-001–002; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK017 ¿Liquidez corriente define activos/pasivos corrientes, fecha y no aplicabilidad sectorial? [spec.md §FR-KPI-002; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK018 ¿ROA y ROE definen utilidad y bases promedio, fallback y período? [spec.md §FR-KPI-002; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK019 ¿Deuda/EBITDA y cobertura de intereses definen EBITDA/EBIT, gasto financiero, signos y salida no significativa? [spec.md §§FR-KPI-002, FR-KPI-006–007; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK020 ¿Flujo operativo, capex, FCF y conversión de caja tienen convenciones de signo y fórmulas exactas? [spec.md §FR-KPI-001–002; analysis-pipeline.md §7] — **Resultado: Bloqueante** (`H-B02`)
## Valuación

- [ ] CHK021 ¿Capitalización define precio, clase, shares outstanding/diluted, fecha y split/ADR? [spec.md §§FR-VAL-001–002, FR-VAL-005; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B10`)
- [ ] CHK022 ¿Enterprise value define deuda, caja, preferred, minoritarios y otros ajustes con reglas de disponibilidad? [spec.md §FR-VAL-003; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK023 ¿P/E y earnings yield definen beneficio TTM, signo, shares y salida con beneficio ≤0? [spec.md §FR-VAL-004; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK024 ¿P/S y P/B definen denominador, período, signo y clase de capital? [spec.md §FR-VAL-004; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK025 ¿EV/EBITDA y EV/ventas definen denominadores compatibles y salida con valores cero/negativos? [spec.md §§FR-VAL-004, FR-KPI-006; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK026 ¿FCF yield define FCF, capitalización/EV elegido y tratamiento de FCF negativo? [spec.md §FR-VAL-004; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK027 ¿Dividend yield está inequívocamente dentro o fuera del MVP y tiene fuente autorizada? [analysis-pipeline.md §8; spec.md §FR-VAL-004] — **Resultado: Menor** (`H-M02`)
- [x] CHK028 ¿La incompatibilidad de moneda bloquea sin conversión automática y explica la causa? [spec.md §§FR-VAL-006–007; analysis-pipeline.md §8] — **Resultado: Aprobado** (`A-010`)
## Insights

- [ ] CHK029 ¿Cada regla posee código, versión, capa, AST/DSL, inputs, umbral, prioridad y perfil aplicable? [spec.md §§FR-INS-001–003; data-model.md §3.15; analysis-pipeline.md §9] — **Resultado: Bloqueante** (`H-B03`)
- [ ] CHK030 ¿Las señales favorables, desfavorables, mixtas e insuficientes tienen agregación y desempate normativos? [spec.md §FR-INS-004; analysis-pipeline.md §9] — **Resultado: Bloqueante** (`H-B03`)
- [ ] CHK031 ¿La confianza del insight define cómo combinan calidad, cobertura, frescura, estimaciones y discrepancias? [spec.md §§FR-INS-003–005, FR-DQ-005; data-model.md §3.16] — **Resultado: Bloqueante** (`H-B03`)
- [ ] CHK032 ¿La regla de “conclusión fuerte” define cuantitativamente cobertura suficiente y riesgo crítico? [spec.md §FR-INS-005; analysis-pipeline.md §9] — **Resultado: Bloqueante** (`H-B03`)
- [x] CHK033 ¿Cada texto expone evidencia, limitación, variable a seguir y ausencia de personalización? [spec.md §§FR-INS-003, FR-INS-007; data-model.md §3.16] — **Resultado: Aprobado** (`A-004`)
## Determinismo

- [x] CHK034 ¿Mismos inputs, versiones y parámetros producen el mismo JSON semántico y orden estable? [analysis-pipeline.md §§9–10; spec.md §FR-INS-002] — **Resultado: Aprobado** (`A-013`)
- [ ] CHK035 ¿Los fixtures dorados incluyen tolerancias exactas y casos de datos faltantes/negativos/no aplicables? [research.md Decision 12; quickstart.md Scenarios E–G] — **Resultado: Bloqueante** (`H-B12`)

## Notas

- Los hallazgos consolidados se encuentran en [`../CHECKLIST_FINDINGS_MATRIX.md`](../CHECKLIST_FINDINGS_MATRIX.md).
- Los bloqueantes se encuentran en [`../CHECKLIST_BLOCKERS.md`](../CHECKLIST_BLOCKERS.md).
- El dictamen de fase se encuentra en [`../CHECKLIST_EXECUTION_REPORT.md`](../CHECKLIST_EXECUTION_REPORT.md).
