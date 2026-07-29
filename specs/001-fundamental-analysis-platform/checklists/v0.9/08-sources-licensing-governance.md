# Checklist v0.9 — Fuentes, licencias y gobierno de terceros

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-LG-001 — **Condición sí/no:** ¿SEC está habilitado y sujeto a Fair Access? — **Evidencia:** source-policy-matrix.md; spec.md; SEC oficial — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-002 — **Condición sí/no:** ¿CSV y entrada manual están habilitados? — **Evidencia:** source-policy-matrix.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-003 — **Condición sí/no:** ¿Twelve Data está disabled-by-default? — **Evidencia:** source-policy-matrix.md; spec.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-004 — **Condición sí/no:** ¿Alpha Vantage está disabled-by-default? — **Evidencia:** source-policy-matrix.md; spec.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-005 — **Condición sí/no:** ¿BYO-key no es dependencia obligatoria? — **Evidencia:** spec.md; historias US-02/03 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-006 — **Condición sí/no:** ¿La matriz trata display, redistribución, retención, cache, atribución y API key? — **Evidencia:** source-policy-matrix.md — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-007 — **Condición sí/no:** ¿La revisión tiene fecha y vencimiento? — **Evidencia:** source-policy-matrix.md — **Resultado:** `PASS` — **Observación:** 2026-07-20 / 2026-10-18.
- [x] V09-LG-008 — **Condición sí/no:** ¿Una revisión vencida deshabilita el proveedor? — **Evidencia:** spec.md FR-SRC-003; matrix rules — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-LG-009 — **Condición sí/no:** ¿No se afirman permisos contractuales inciertos? — **Evidencia:** source-policy-matrix.md; términos oficiales — **Resultado:** `PASS` — **Observación:** Sí; proveedores inciertos quedan bloqueados.
- [ ] V09-LG-010 — **Condición sí/no:** ¿El contrato público expone inequívocamente el estado efectivo `enabled` después de evaluar expiración? — **Evidencia:** V09-I03 — **Resultado:** `FAIL` — **Observación:** No; solo enabledByDefault.

**Resumen:** 9 PASS / 1 FAIL.
