# Checklist v0.9 — Consistencia transversal

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-TC-001 — **Condición sí/no:** ¿Constitución y especificación coinciden en browser-first, bajo demanda y ausencia de asesoramiento? — **Evidencia:** constitution.md; spec.md — **Resultado:** `PASS` — **Observación:** Alineación confirmada.
- [x] V09-TC-002 — **Condición sí/no:** ¿Especificación y aclaraciones mantienen el mismo alcance MVP? — **Evidencia:** spec.md; clarification-remediation.md — **Resultado:** `PASS` — **Observación:** No se detectó expansión silenciosa.
- [x] V09-TC-003 — **Condición sí/no:** ¿Plan y research sostienen Pages + gateway ligero + Web Worker + IDB opt-in + D1 mínimo? — **Evidencia:** plan.md; research.md — **Resultado:** `PASS` — **Observación:** Arquitectura consistente.
- [ ] V09-TC-004 — **Condición sí/no:** ¿Data model, OpenAPI y adapter usan el mismo MarketSeries/MarketObservation? — **Evidencia:** V09-B01 — **Resultado:** `FAIL` — **Observación:** Nombres, campos y obligatoriedad divergen.
- [ ] V09-TC-005 — **Condición sí/no:** ¿MetricResult, cobertura, errores y UX usan vocabularios cerrados compatibles? — **Evidencia:** V09-B04/V09-I04 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-TC-006 — **Condición sí/no:** ¿Identidad, shares y valuación comparten una única unidad de cuenta? — **Evidencia:** V09-B02 — **Resultado:** `FAIL` — **Observación:** No para multiclase/ADR.
- [ ] V09-TC-007 — **Condición sí/no:** ¿OpenAPI SEC y mapping XBRL soportan todas las taxonomías priorizadas? — **Evidencia:** V09-B05 — **Resultado:** `FAIL` — **Observación:** No; endpoint solo us-gaap y shares prioritario DEI.
- [x] V09-TC-008 — **Condición sí/no:** ¿Pipeline e IndexedDB conservan versiones/fingerprints y excluyen credenciales? — **Evidencia:** analysis-pipeline.md; browser-storage.md — **Resultado:** `PASS` — **Observación:** Consistente.
- [x] V09-TC-009 — **Condición sí/no:** ¿Quickstart refleja la arquitectura y los gates documentales? — **Evidencia:** quickstart.md; plan.md — **Resultado:** `PASS` — **Observación:** Consistente salvo casos faltantes registrados.
- [x] V09-TC-010 — **Condición sí/no:** ¿Dividend yield y total return están fuera del MVP en todos los documentos? — **Evidencia:** spec.md; metric-catalog.md; pipeline — **Resultado:** `PASS` — **Observación:** Consistente.

**Resumen:** 6 PASS / 4 FAIL.
