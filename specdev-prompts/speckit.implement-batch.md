---
description: Implement exactly one authorized FinScope batch with field-scoped authority and evidence-safe closure
---

## Input

Optional expected batch ID: `$ARGUMENTS`. It must equal `IMPLEMENTATION_STATE.json.activeBatchId`.

## Procedure

1. Verify ZIP/sidecar, CRC, root, extraction safety, Windows paths, manifest, inventory, metadata, secrets and `.specify` bytes.
2. Read Constitution, phase status, documentation index, `AUTHORITY_MATRIX.json`, execution protocol, context policy and state.
3. Resolve the active `batchFile`; verify `TASK_SOURCE_LOCK.json`, task hashes and batch mirror consistency.
4. Validate external dependencies, current statuses, test discovery and actual runtime capabilities before writing.
5. Load exact task lines, FR/NFR, AC, primary authorities, fixtures, composition contracts, target files and tests.
6. Execute only tasks in `executionOrder`; never infer an undeclared file or behavior.
7. For each task, implement declared files/tests and prove `doneWhen` with mandatory commands.
8. If every command can run and passes, mark task `COMPLETED` and `[X]`.
9. If required execution is unavailable, mark `IMPLEMENTED_PENDING_VALIDATION`, batch `LOCAL_VALIDATION_REQUIRED`, keep all checkboxes open and produce a candidate.
10. On failure, stop affected dependents and record `PARTIAL`/`BLOCKED`; never weaken authorities.
11. Update state, mirrors, ledger, report, metadata, inventory and manifest; preserve `.specify`.
12. Emit full ZIP + sidecar. A candidate goes only to the chat; a completed package may replace Fuentes.
13. Stop. Never begin the next batch in the same conversation.

## Required output

- authoritative baseline identity and batch status;
- completed/pending/blocked tasks;
- exact commands and outcomes or explicit local-validation requirement;
- full ZIP plus sidecar and report;
- exact placement/replacement instructions;
- next authorized batch without executing it.
