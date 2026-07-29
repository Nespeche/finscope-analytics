# Promoción final — hardening del plano de control

**Decisión:** `COMPLETED`  
**Candidato:** `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_candidate_r1.zip`  
**SHA-256 candidato:** `4da4412b15630093bad16328cff5beb76d9c38868dfa6df06cc1a95dfb2c4006`  
**Evidencia:** `FinScope_control_plane_evidence_20260723-222845.zip`  
**SHA-256 evidencia:** `f346f87204842dff8cebb5ac51ae25b7ce07c81b4c5a0c82c822e91698914d0f`  
**Paquete promovido:** `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_completed.zip`  
**SHA-256 del paquete promovido:** registrado exclusivamente en el sidecar externo para evitar autorreferencia.

## Resultado

La identidad física y lógica del candidato, su sidecar, la extracción utilizada y el bundle de evidencia coinciden. La evidencia contiene las ocho ejecuciones obligatorias en orden, todas `PASS` y con exit code `0`. No existen etapas omitidas ni `NOT_RUN`.

| Validación | Resultado |
|---|---|
| `npm ci` | PASS |
| Chromium para Playwright | PASS |
| `npm run validate:control-plane` | PASS — 991/991 controles |
| `npm run typecheck` | PASS |
| contratos del plano de control | PASS — 3 archivos, 15 tests |
| `npm run test` | PASS — 11 archivos, 39 tests |
| `npm run test:browser` | PASS — desktop y mobile, 2 tests |
| `npm run build` | PASS — 115 módulos, 3 assets |

## Controles estructurales

- 109 definiciones de tarea y sus hashes verificados contra `tasks.md`;
- 25 lotes y sus hashes full-file verificados contra `TASK_SOURCE_LOCK.json`;
- IDs, dependencias, archivos, pruebas y Done when de las 109 tareas contrastados;
- mapa JSON/Markdown, estado, índice, gates y metadata consistentes;
- cuatro mutaciones deliberadas rechazadas de forma fail-closed;
- auditoría independiente: 61/61 controles PASS.

## Cierre allowlist

Después del PASS no se modificaron código, tests, runners, scripts, schemas, dependencias, fixtures ni comportamiento. Solo se modificaron contexto activo, estado, revisión de mirrors/locks, ledger, reportes, metadata, inventario y manifiesto; se añadieron exclusivamente estos dos reportes de promoción.

`.specify` permanece 19/19 byte-idéntico. `spec.md` y `tasks.md` permanecen sin cambios. B01/B02 están completados; B03 queda pendiente y no iniciado; convergencia continúa cerrada.
