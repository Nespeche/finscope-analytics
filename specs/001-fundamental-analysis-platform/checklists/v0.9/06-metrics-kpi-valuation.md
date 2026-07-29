# Checklist v0.9 — Métricas, KPI y valuación

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-MK-001 — **Condición sí/no:** ¿Existen exactamente 36 métricas con IDs únicos? — **Evidencia:** metric-catalog.md; validación automatizada — **Resultado:** `PASS` — **Observación:** 36, sin duplicados.
- [x] V09-MK-002 — **Condición sí/no:** ¿Cada métrica contiene fórmula, numerador, denominador, unidad, moneda, período, redondeo, nulos, negativos, muestra, aplicabilidad y limitaciones? — **Evidencia:** metric-catalog.md; validación automatizada — **Resultado:** `PASS` — **Observación:** Todos los campos estructurales están presentes.
- [x] V09-MK-003 — **Condición sí/no:** ¿Volatilidad, drawdown, medias y posición de rango tienen ventana/muestra explícita? — **Evidencia:** metric-catalog.md MKT_* — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MK-004 — **Condición sí/no:** ¿ROA, ROE, deuda neta/EBITDA, FCF y conversión de caja tienen fórmula explícita? — **Evidencia:** metric-catalog.md FND_* — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-MK-005 — **Condición sí/no:** ¿P/E, earnings yield, P/S, P/B, EV/Sales, EV/EBITDA y FCF yield tienen fórmula explícita? — **Evidencia:** metric-catalog.md VAL_* — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-MK-006 — **Condición sí/no:** ¿La unidad de cuenta de market cap es compatible con fundamentales consolidados en todo instrumento permitido? — **Evidencia:** V09-B02 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-MK-007 — **Condición sí/no:** ¿ADR conocido tiene conversión/fórmula y aplicabilidad no contradictorias? — **Evidencia:** V09-B02 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-MK-008 — **Condición sí/no:** ¿El estado `not_meaningful` está definido en un enum canónico? — **Evidencia:** V09-B04 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-MK-009 — **Condición sí/no:** ¿Los metadatos de cero y denominador son internamente coherentes en las 36 métricas? — **Evidencia:** V09-I02 — **Resultado:** `FAIL` — **Observación:** No en cinco definiciones.
- [x] V09-MK-010 — **Condición sí/no:** ¿Dividend yield y total return permanecen fuera del MVP? — **Evidencia:** metric-catalog.md reglas globales; spec.md — **Resultado:** `PASS` — **Observación:** Sí.

**Resumen:** 6 PASS / 4 FAIL.
