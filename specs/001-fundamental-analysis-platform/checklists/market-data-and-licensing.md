# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Checklist especializado — Datos de mercado y licencias

**Propósito**: Evaluar catálogo, adquisición API/CSV/manual, estadísticas, acciones corporativas, licencias, trazabilidad y degradación.
**Creado**: 2026-07-20
**Feature**: [001-fundamental-analysis-platform](../spec.md)
**Fase**: checklist

> **Convención de evaluación**
>
> - `[x]` = control aprobado o no aplicable con justificación.
> - `[ ]` = control con hallazgo abierto.
> - Severidades: `Bloqueante`, `Importante`, `Menor`, `Aprobado`, `No aplicable`.
> - Los ítems evalúan la calidad de requisitos y planificación; no son tareas de implementación.

## Universo e identidad

- [ ] CHK001 ¿El origen del catálogo permite obtener de forma trazable emisor, ticker, mercado, MIC, moneda, tipo, clase y CIK requeridos? [spec.md §§FR-CAT-001–004; research.md Decision 6; data-model.md §§3.1–3.3] — **Resultado: Bloqueante** (`H-B09`)
- [ ] CHK002 ¿Está definida la resolución de ticker reutilizado, múltiples listings y cambios históricos de símbolo? [spec.md §Edge Cases; data-model.md §§3.1–3.2] — **Resultado: Bloqueante** (`H-B09`)
- [ ] CHK003 ¿La relación ADR–acción subyacente, ratio ADR y clases múltiples tiene fuente autorizada, estados desconocidos y bloqueo de valuación? [spec.md §§FR-VAL-005, Edge Cases; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B09`)
- [x] CHK004 ¿La ausencia de una API de búsqueda compatible deja una ruta local/CSV/manual utilizable sin bloquear el producto? [spec.md §§FR-CAT-006–008, FR-SRC-001; plan.md §AD-005] — **Resultado: Aprobado** (`A-007`)
## Adquisición API

- [ ] CHK005 ¿La solicitud diaria define símbolo, mercado, intervalo, ventana, máximo y preferencia de ajuste con validación observable? [spec.md §FR-SRC-005; provider-adapter.md §3; openapi.yaml MarketSeriesRequest] — **Resultado: Importante** (`H-I07`)
- [ ] CHK006 ¿La semántica de startDate/endDate/outputSize, incluidas fechas unilaterales, está definida sin combinaciones ambiguas? [provider-adapter.md §3; openapi.yaml MarketSeriesRequest] — **Resultado: Importante** (`H-I07`)
- [x] CHK007 ¿Cada proveedor declara límites actuales, mercados, historial, ajuste, display y fecha de revisión sin tratarlos como garantía ilimitada? [spec.md §CR-LIC-006; data-model.md §3.4; provider-adapter.md §2] — **Resultado: Aprobado** (`A-005`)
- [ ] CHK008 ¿La cuota agotada incluye retry-after/backoff, prohibición de reintento automático agresivo y alternativa local? [spec.md §§FR-SRC-006, CR-SUS-005; provider-adapter.md §6] — **Resultado: Importante** (`H-I06`)
- [ ] CHK009 ¿La cancelación define qué ocurre con fetch, gateway, Web Worker, memoria de credencial y estado UI? [spec.md §FR-SRC-009; analysis-pipeline.md §§3–4, 11; quickstart.md Scenario D] — **Resultado: Importante** (`H-I08`)
- [ ] CHK010 ¿La credencial se acepta por un único canal que no pueda aparecer en URL, access logs ni headers reenviados? [spec.md §FR-SRC-002; provider-adapter.md §3; openapi.yaml /market-series] — **Resultado: Bloqueante** (`H-B06`)
## CSV

- [x] CHK011 ¿El CSV mínimo fecha+cierre y los mapeos opcionales están definidos de forma consistente? [spec.md §§FR-IMP-001–003; provider-adapter.md §9] — **Resultado: Aprobado** (`A-007`)
- [ ] CHK012 ¿Los formatos de fecha, zona horaria, separador decimal, delimitador y codificación tienen resolución de ambigüedad normativa? [spec.md §FR-IMP-002; provider-adapter.md §9] — **Resultado: Importante** (`H-I03`)
- [ ] CHK013 ¿Los límites de archivo y filas son únicos, observables y coherentes con el requisito “configurable”? [spec.md §CR-SEC-005; provider-adapter.md §9; browser-storage.md §8] — **Resultado: Importante** (`H-I03`)
- [ ] CHK014 ¿La validación contempla contenido activo de planilla, fórmulas, NUL, CSV bombs, columnas excesivas y mensajes sanitizados? [spec.md §§CR-SEC-005–007; provider-adapter.md §9] — **Resultado: Importante** (`H-I03`)
- [ ] CHK015 ¿Está definido si filas inválidas bloquean todo el cálculo o permiten un subconjunto con cobertura parcial? [spec.md §FR-IMP-003; provider-adapter.md §9; analysis-pipeline.md §6] — **Resultado: Importante** (`H-I06`)
## Entrada manual

- [ ] CHK016 ¿El conjunto obligatorio lastClose/min/max/average/período/moneda/origen es consistente y valida min≤average≤max? [spec.md §FR-IMP-005; data-model.md §3.7; provider-adapter.md §10] — **Resultado: Bloqueante** (`H-B07`)
- [x] CHK017 ¿Las capacidades deshabilitadas por ausencia de observaciones individuales están enumeradas? [spec.md §FR-IMP-006; analysis-pipeline.md §6] — **Resultado: Aprobado** (`A-007`)
## Precios y estadísticas

- [ ] CHK018 ¿La selección entre close y adjustedClose está gobernada por una regla normativa y visible? [spec.md §§FR-MKT-010–011; provider-adapter.md §3; analysis-pipeline.md §6] — **Resultado: Bloqueante** (`H-B10`)
- [ ] CHK019 ¿Splits, dividendos y otras acciones corporativas están soportados con fuente y fórmula o explícitamente excluidos por métrica? [spec.md §§FR-MKT-011, FR-VAL-005; analysis-pipeline.md §8] — **Resultado: Bloqueante** (`H-B10`)
- [ ] CHK020 ¿La definición de último cierre considera calendario de mercado, feriados, zona horaria y sesiones no estándar? [spec.md §§FR-MKT-001, FR-MKT-004; data-model.md §§3.5–3.6] — **Resultado: Bloqueante** (`H-B11`)
- [ ] CHK021 ¿Mínimo, máximo, promedio y mediana especifican población exacta, inclusión de nulos y redondeo? [spec.md §§FR-MKT-005–006, FR-MKT-010; analysis-pipeline.md §6] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK022 ¿Volatilidad define frecuencia, muestra mínima, anualización por mercado y tratamiento de gaps? [spec.md §FR-MKT-008; analysis-pipeline.md §6] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK023 ¿Drawdown define serie base, máximo histórico, fechas pico-valle y tratamiento de ajustes? [spec.md §FR-MKT-008; analysis-pipeline.md §6] — **Resultado: Bloqueante** (`H-B02`)
- [ ] CHK024 ¿La posición en rango define salida cuando min=max y formato porcentual/redondeo? [spec.md §FR-MKT-007; analysis-pipeline.md §6] — **Resultado: Importante** (`H-I05`)
## Licencias

- [x] CHK025 ¿La política impide almacenar, cachear, publicar o redistribuir respuestas personales más allá de lo permitido? [Constitution §III; spec.md §CR-LIC; provider-adapter.md §§2, 7–8] — **Resultado: Aprobado** (`A-005`)
- [ ] CHK026 ¿La habilitación de Twelve Data está respaldada por una interpretación documentada de Internal Use, free-tier, display y retención para este flujo concreto? [spec.md §CR-LIC-002; research.md Decisions 1, 7; provider-adapter.md §7] — **Resultado: Bloqueante** (`H-B01`)
- [ ] CHK027 ¿La habilitación de Alpha Vantage está respaldada por una interpretación documentada de uso personal/no comercial y display dentro del producto? [spec.md §CR-LIC-003; research.md Decisions 1, 7; provider-adapter.md §8] — **Resultado: Bloqueante** (`H-B01`)
- [x] CHK028 ¿Una política vencida o no revisada deshabilita el adaptador sin impedir CSV/manual? [data-model.md §3.4; provider-adapter.md §2; spec.md §CR-LIC-006] — **Resultado: Aprobado** (`A-005`)
## Trazabilidad

- [x] CHK029 ¿Cada serie registra proveedor, policyVersion, fecha de recepción, last refreshed, ajuste, truncamiento y cantidad devuelta? [provider-adapter.md §5; data-model.md §§3.5–3.6] — **Resultado: Aprobado** (`A-006`)
- [ ] CHK030 ¿El análisis conserva moneda, zona horaria, ventana solicitada, ventana efectiva y fingerprint canónico? [spec.md §FR-MKT-010; data-model.md §§3.6, 3.17; analysis-pipeline.md §10] — **Resultado: Importante** (`H-I05`)
## Degradación

- [x] CHK031 ¿La falta de proveedor, mercado no autorizado o cuota agotada conduce explícitamente a CSV/manual sin pérdida del instrumento seleccionado? [spec.md §§FR-SRC-006, Edge Cases; quickstart.md Scenarios C–D] — **Resultado: Aprobado** (`A-007`)
- [ ] CHK032 ¿Una serie parcial o truncada define qué análisis siguen habilitados y cómo afecta confianza? [provider-adapter.md §5; spec.md §§FR-DQ-002–005] — **Resultado: Importante** (`H-I06`)

## Notas

- Los hallazgos consolidados se encuentran en [`../CHECKLIST_FINDINGS_MATRIX.md`](../CHECKLIST_FINDINGS_MATRIX.md).
- Los bloqueantes se encuentran en [`../CHECKLIST_BLOCKERS.md`](../CHECKLIST_BLOCKERS.md).
- El dictamen de fase se encuentra en [`../CHECKLIST_EXECUTION_REPORT.md`](../CHECKLIST_EXECUTION_REPORT.md).
