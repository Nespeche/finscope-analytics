# Checklist v0.9 — Calidad de requisitos

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-RQ-001 — **Condición sí/no:** ¿El propósito, actores, alcance y fuera de alcance están explícitos? — **Evidencia:** spec.md §§1–2 — **Resultado:** `PASS` — **Observación:** El MVP excluye tiempo real, trading, recomendaciones, dividend yield y total return.
- [x] V09-RQ-002 — **Condición sí/no:** ¿Cada requisito funcional tiene identificador único y lenguaje normativo? — **Evidencia:** spec.md §4; validación automatizada — **Resultado:** `PASS` — **Observación:** 84 FR definidos sin identificadores duplicados.
- [x] V09-RQ-003 — **Condición sí/no:** ¿Los límites cuantitativos principales tienen unidades y umbrales? — **Evidencia:** spec.md §§4–6 — **Resultado:** `PASS` — **Observación:** Tamaños, fechas, requests, p95 y tolerancia numérica están explicitados.
- [ ] V09-RQ-004 — **Condición sí/no:** ¿Todos los comportamientos financieros críticos son implementables sin elegir reglas no documentadas? — **Evidencia:** V09-B02, V09-B03, V09-B05 — **Resultado:** `FAIL` — **Observación:** Unidad de cuenta, confianza y fallback requieren decisiones no cerradas.
- [ ] V09-RQ-005 — **Condición sí/no:** ¿Todos los estados usados por métricas y errores pertenecen a vocabularios cerrados? — **Evidencia:** V09-B04 — **Resultado:** `FAIL` — **Observación:** `not_meaningful` y varios códigos no tienen contrato transversal cerrado.
- [x] V09-RQ-006 — **Condición sí/no:** ¿Los requisitos prohíben recomendaciones, buy/sell, objetivos y promesas? — **Evidencia:** spec.md FR-INS-004; insight-rule-catalog.md §1 — **Resultado:** `PASS` — **Observación:** Prohibición consistente.
- [x] V09-RQ-007 — **Condición sí/no:** ¿No existen requisitos ocultos de proveedor pago? — **Evidencia:** spec.md FR-SRC; source-policy-matrix.md — **Resultado:** `PASS` — **Observación:** SEC/CSV/manual sostienen el MVP; proveedores personales están bloqueados.
- [ ] V09-RQ-008 — **Condición sí/no:** ¿Cada requisito crítico tiene criterio observable específico? — **Evidencia:** spec.md §7; V09-I05 — **Resultado:** `FAIL` — **Observación:** Faltan casos propios para CEDEAR no mapeado y policy expiry.
- [x] V09-RQ-009 — **Condición sí/no:** ¿Los requisitos de accesibilidad son verificables? — **Evidencia:** spec.md QR-A11Y/RESP — **Resultado:** `PASS` — **Observación:** WCAG 2.2 AA, teclado, foco, lector, equivalencia y 360 px.
- [x] V09-RQ-010 — **Condición sí/no:** ¿Los requisitos de privacidad y persistencia son explícitos? — **Evidencia:** spec.md FR-LOC/SRC; browser-storage.md — **Resultado:** `PASS` — **Observación:** session_only, consentimiento y datos prohibidos están definidos.

**Resumen:** 7 PASS / 3 FAIL.
