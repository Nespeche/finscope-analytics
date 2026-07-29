# Checklist v0.9 — IndexedDB y persistencia local

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-ID-001 — **Condición sí/no:** ¿session_only es el default? — **Evidencia:** browser-storage.md; spec.md FR-LOC-001 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-002 — **Condición sí/no:** ¿Se exige consentimiento antes del primer write persistente? — **Evidencia:** browser-storage.md §2 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-003 — **Condición sí/no:** ¿Los stores lógicos están enumerados? — **Evidencia:** browser-storage.md §3; data-model.md §4 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-004 — **Condición sí/no:** ¿Claves/fingerprints y contenido permitido están definidos? — **Evidencia:** browser-storage.md §3 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-005 — **Condición sí/no:** ¿Hay expiración y comportamiento de cache vigente/vencida? — **Evidencia:** browser-storage.md §6 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-006 — **Condición sí/no:** ¿Hay versionado/migración con rollback no destructivo? — **Evidencia:** browser-storage.md §7 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-007 — **Condición sí/no:** ¿Cuotas 50 MiB, 80% y 95% están cerradas? — **Evidencia:** browser-storage.md §5 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-008 — **Condición sí/no:** ¿Exportación neutraliza fórmulas y excluye secretos? — **Evidencia:** browser-storage.md §8 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-009 — **Condición sí/no:** ¿Eliminación y limpieza de temporales están definidas? — **Evidencia:** browser-storage.md §§9–10 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-ID-010 — **Condición sí/no:** ¿Datos prohibidos incluyen keys y Company Facts raw por defecto? — **Evidencia:** browser-storage.md §4 — **Resultado:** `PASS` — **Observación:** Sí.

**Resumen:** 10 PASS / 0 FAIL.
