# Checklist v0.9 — UX, accesibilidad y estados degradados

**Ejecución:** `2026-07-20`  
**Baseline auditado:** `v0.8_remediation`  
**Fase:** `checklist`  
**Regla:** `[x]` = PASS; `[ ]` = FAIL. Cada condición evalúa documentación, no código.

- [x] V09-UX-001 — **Condición sí/no:** ¿WCAG 2.2 AA y teclado/foco/lector están requeridos? — **Evidencia:** spec.md QR-A11Y-001 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-UX-002 — **Condición sí/no:** ¿Cada SVG tiene tabla y texto equivalente? — **Evidencia:** spec.md FR-ARCH-003/QR-A11Y-002 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-UX-003 — **Condición sí/no:** ¿La UI no depende solo del color? — **Evidencia:** spec.md QR-A11Y-001 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-UX-004 — **Condición sí/no:** ¿Se exige responsive desde 360 px sin scroll horizontal? — **Evidencia:** spec.md QR-RESP-001 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-UX-005 — **Condición sí/no:** ¿stale/partial/truncated/blocked/cancelled tienen mensajes y recuperación? — **Evidencia:** state matrix §4 — **Resultado:** `PASS` — **Observación:** Sí para los estados listados.
- [x] V09-UX-006 — **Condición sí/no:** ¿Cuota/proveedor/policy ofrecen CSV/manual? — **Evidencia:** spec.md FR-STATE-004 — **Resultado:** `PASS` — **Observación:** Sí.
- [x] V09-UX-007 — **Condición sí/no:** ¿No se borra el último snapshot ante error/cancelación? — **Evidencia:** spec.md FR-STATE-002; pipeline — **Resultado:** `PASS` — **Observación:** Sí.
- [ ] V09-UX-008 — **Condición sí/no:** ¿Cada Problem.code tiene mensaje, capacidad bloqueada y recuperación normativa? — **Evidencia:** V09-I04 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-UX-009 — **Condición sí/no:** ¿La UX puede mostrar `not_meaningful` con semántica canónica? — **Evidencia:** V09-B04 — **Resultado:** `FAIL` — **Observación:** No.
- [ ] V09-UX-010 — **Condición sí/no:** ¿Todos los estados de insights tienen salida visible cuando ninguna regla activa? — **Evidencia:** V09-B03 — **Resultado:** `FAIL` — **Observación:** No.

**Resumen:** 7 PASS / 3 FAIL.
