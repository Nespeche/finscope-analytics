# DOCUMENTATION INDEX — FinScope Analytics B21 release hold

## Entrada obligatoria

1. `START_HERE_CHATGPT.md`;
2. `.specify/memory/constitution.md`;
3. `V0.21_PHASE_STATUS.md`;
4. `implementation-control/AUTHORITY_MATRIX.json`;
5. `implementation-control/IMPLEMENTATION_STATE.json`;
6. `implementation-control/TASK_SOURCE_LOCK.json`;
7. `implementation-control/IMPLEMENTATION_BATCH_MAP.json`;
8. `implementation-control/batches/B22.json`;
9. `implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md`;
10. `implementation-control/GITHUB_HANDOFF.json`;
11. `implementation-control/reports/B21_EVIDENCE_VERIFICATION_AND_CLOSURE.md`;
12. `implementation-control/reports/B21_CLEAN_PACKAGE_REMEDIATION_CLOSURE.md`.

## Gate y hold activo

`tasksAuthorized=true`, `analysisAuthorized=true`, `implementationAuthorized=true`, `convergenceAuthorized=false`.

B01–B21 y T001–T095 están `COMPLETED`. B22 es `PENDING`, pero las ramas ordinarias quedan bloqueadas mientras `release.pending=true`; solo se permiten operaciones especiales autenticadas declaradas en el handoff.

## Baseline y entrega

El baseline completed vigente es `FS_v0.21.25_B20_completed.zip`. El Release histórico B21 permanece rechazado. La identidad de reemplazo preparada es `v0.21.27-B21-completed-r2` / `FS_v0.21.27_B21_completed_r2.zip` y no se convierte en baseline hasta publicación y reautenticación post-publicación.

Raíz normativa: `FinScope_v0.21.4/`; `.specify`: 19 archivos byte-inmutables.
