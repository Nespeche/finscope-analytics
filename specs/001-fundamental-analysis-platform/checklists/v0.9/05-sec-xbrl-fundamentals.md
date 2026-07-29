# Checklist v0.9 — Fundamentales SEC/XBRL

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-SX-001 — **Condición sí/no:** ¿SEC se usa por acción explícita y CIK de 10 dígitos? — **Evidencia:** spec.md FR-FIN-001; OpenAPI Cik — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-002 — **Condición sí/no:** ¿Fair Access y User-Agent están requeridos con límite interno <=5 req/s? — **Evidencia:** spec.md FR-FIN-002; SEC oficial — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-003 — **Condición sí/no:** ¿Payloads tienen caps 2/8 MiB, streaming, timeout y cancelación? — **Evidencia:** spec.md FR-FIN-004/005; OpenAPI; plan — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-004 — **Condición sí/no:** ¿El navegador, no el Worker, normaliza XBRL? — **Evidencia:** spec.md FR-FIN-003; pipeline — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-005 — **Condición sí/no:** ¿Se conservan fechas, accession, forma, taxonomía, unidad, escala y restatement? — **Evidencia:** spec.md FR-FIN-008; data-model.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-006 — **Condición sí/no:** ¿Facts ambiguos bloquean la métrica? — **Evidencia:** spec.md FR-FIN-009; xbrl catalog — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-SX-007 — **Condición sí/no:** ¿Bancos, aseguradoras, REITs e IFRS/20-F tienen degradación explícita? — **Evidencia:** spec.md FR-FIN-010/011; xbrl catalog — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-SX-008 — **Condición sí/no:** ¿El fallback >8 MiB selecciona determinísticamente <=10 conceptos? — **Evidencia:** V09-B05 — **Resultado:** `FAIL` — **Observación:** No hay prioridad por capa ni regla de parada.
- [ ] V09-SX-009 — **Condición sí/no:** ¿El endpoint companyconcept permite todas las taxonomías del mapping? — **Evidencia:** V09-B05 — **Resultado:** `FAIL` — **Observación:** No: restringe a us-gaap y el primer shares es DEI.
- [ ] V09-SX-010 — **Condición sí/no:** ¿La respuesta SEC modela contractualmente trazabilidad/cobertura/frescura/limitaciones? — **Evidencia:** V09-I01 — **Resultado:** `FAIL` — **Observación:** No; schemas 200 son objetos genéricos.

**Resumen:** 7 PASS / 3 FAIL.
