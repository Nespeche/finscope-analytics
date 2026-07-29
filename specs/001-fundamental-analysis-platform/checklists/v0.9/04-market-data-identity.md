# Checklist v0.9 — Datos de mercado e identidad de instrumentos

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-MI-001 — **Condición sí/no:** ¿La búsqueda es local y sin requests externas? — **Evidencia:** spec.md FR-CAT-001/008 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MI-002 — **Condición sí/no:** ¿La identidad distingue ticker, exchange/MIC, clase, moneda, tipo y subyacente? — **Evidencia:** spec.md FR-CAT-003/004; data-model.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MI-003 — **Condición sí/no:** ¿Las ventanas son inclusivas y rango/outputSize son excluyentes? — **Evidencia:** spec.md FR-MKT-004/005; OpenAPI — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MI-004 — **Condición sí/no:** ¿Precios/OHLC/volumen tienen invariantes verificables? — **Evidencia:** spec.md FR-MKT-001/003 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MI-005 — **Condición sí/no:** ¿No se rellenan días ni se infieren ajustes? — **Evidencia:** spec.md FR-MKT-006/009 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MI-006 — **Condición sí/no:** ¿Ajuste desconocido bloquea métricas sensibles? — **Evidencia:** spec.md FR-MKT-010; metric catalog — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-MI-007 — **Condición sí/no:** ¿El contrato HTTP devuelve la misma serie canónica que exige el modelo? — **Evidencia:** V09-B01 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-MI-008 — **Condición sí/no:** ¿La relación entre clase/listing/ADR y shares para valuación es inequívoca? — **Evidencia:** V09-B02 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-MI-009 — **Condición sí/no:** ¿ADR con ratio conocido tiene una política consistente entre spec y catálogo? — **Evidencia:** spec.md FR-CAT-005; metric-catalog VAL_MARKET_CAP — **Resultado:** `FAIL` — **Observación:** No: la spec sugiere habilitación; el catálogo excluye ADR.
- [x] V09-MI-010 — **Condición sí/no:** ¿CEDEAR sin mapping queda fuera del fundamental automático? — **Evidencia:** spec.md FR-CAT-006 — **Resultado:** `PASS` — **Observación:** Sí, pero falta AC específico (V09-I05).

**Resumen:** 7 PASS / 3 FAIL.
