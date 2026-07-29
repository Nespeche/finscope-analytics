# Checklist v0.9 — Testabilidad y criterios de aceptación

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-TA-001 — **Condición sí/no:** ¿Hay AC para API autorizada, CSV y entrada manual? — **Evidencia:** AC-001/002/003 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-002 — **Condición sí/no:** ¿Hay AC para policy block, quota y provider unavailable? — **Evidencia:** AC-004/005/006 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-003 — **Condición sí/no:** ¿Hay AC para ticker y CIK inexistentes? — **Evidencia:** AC-007/008 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-004 — **Condición sí/no:** ¿Hay AC para Company Facts grande, XBRL incompleto, restatement y alias? — **Evidencia:** AC-010/011/012/013 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-005 — **Condición sí/no:** ¿Hay AC para moneda, listing y ADR desconocido? — **Evidencia:** AC-014/015/016 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-006 — **Condición sí/no:** ¿Hay AC para banco, aseguradora, REIT y KPI no aplicable? — **Evidencia:** AC-017/020 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-007 — **Condición sí/no:** ¿Hay AC para stale/expired y adjustment unknown? — **Evidencia:** AC-021/022 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-008 — **Condición sí/no:** ¿Hay AC para cache, consentimiento, cuota local y cancelación? — **Evidencia:** AC-023/028 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-009 — **Condición sí/no:** ¿Hay AC para partial/truncated/mixed/low/insufficient? — **Evidencia:** AC-029/033 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-TA-010 — **Condición sí/no:** ¿Hay AC para CSV formula, duplicate conflict y reproducibilidad? — **Evidencia:** AC-034/036 — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-TA-011 — **Condición sí/no:** ¿Existe AC específico para CEDEAR no mapeado? — **Evidencia:** FR-CAT-006; V09-I05 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-TA-012 — **Condición sí/no:** ¿Existe AC específico para revisión de policy vencida y kill switch? — **Evidencia:** FR-SRC-003; V09-I05 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-TA-013 — **Condición sí/no:** ¿Los AC pueden ejecutarse sin resolver V09-B01–B05? — **Evidencia:** matriz de bloqueantes — **Resultado:** `FAIL` — **Observación:** No.

**Resumen:** 10 PASS / 3 FAIL.
