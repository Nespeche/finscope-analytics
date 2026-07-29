# Checklist v0.9 — Insights, confianza y cobertura

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-IC-001 — **Condición sí/no:** ¿Cada regla contiene los 16 campos normativos requeridos? — **Evidencia:** insight-rule-catalog.md; validación automatizada — **Resultado:** `PASS` — **Observación:** 12 reglas completas estructuralmente.
- [x] V09-IC-002 — **Condición sí/no:** ¿Los pesos 35/25/20/20 suman exactamente 100%? — **Evidencia:** insight-rule-catalog.md §2 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-IC-003 — **Condición sí/no:** ¿Se definen caps por ausencia, ajuste, identidad y política? — **Evidencia:** insight-rule-catalog.md §2.2 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-IC-004 — **Condición sí/no:** ¿Se prohíben buy/sell, precio objetivo, promesas y recomendaciones? — **Evidencia:** insight-rule-catalog.md §1; spec.md FR-INS-004 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-IC-005 — **Condición sí/no:** ¿Se define `mixed` para señales contrapuestas? — **Evidencia:** insight-rule-catalog.md §3; INS-009/012 — **Resultado:** `PASS` — **Observación:** Sí, pero su materialidad no está cerrada.
- [x] V09-IC-006 — **Condición sí/no:** ¿Información insuficiente activa una regla específica? — **Evidencia:** INS-001 — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-IC-007 — **Condición sí/no:** ¿Los intervalos de clasificación cubren [0,1] sin huecos ni solapamientos? — **Evidencia:** V09-B03 — **Resultado:** `FAIL` — **Observación:** No según notación literal con precisión completa.
- [ ] V09-IC-008 — **Condición sí/no:** ¿Cada MetricResult tiene un algoritmo numérico normativo de confianza? — **Evidencia:** V09-B03; data-model.md — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-IC-009 — **Condición sí/no:** ¿“materialmente relevante” y “capa material” tienen definición objetiva? — **Evidencia:** INS-009/011/012 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-IC-010 — **Condición sí/no:** ¿Existe salida determinística cuando ningún insight ordinario activa con datos suficientes? — **Evidencia:** catálogo completo — **Resultado:** `FAIL` — **Observación:** No se define neutral/empty synthesis.

**Resumen:** 6 PASS / 4 FAIL.
