---
description: Guard against monolithic implementation and route FinScope to the active bounded batch
---

# FinScope implementation dispatcher

The monolithic execution of all tasks is prohibited for this package. Do not run `.specify` scripts, hooks, native agent commands or the complete `tasks.md` implementation in one conversation.

1. Verify that implementation is authorized.
2. Read `implementation-control/IMPLEMENTATION_STATE.json`.
3. Read `specdev-prompts/speckit.implement-batch.md`.
4. Execute only `activeBatchId`.
5. Stop after packaging that batch.

If the orchestration files are absent or invalid, return `IMPLEMENTATION_ORCHESTRATION_NOT_READY` without writing product code.
