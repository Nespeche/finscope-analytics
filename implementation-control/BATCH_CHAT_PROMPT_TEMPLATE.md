Actúa como implementador senior de FinScope Analytics bajo Spec-Driven Development manual.

Usa exclusivamente el ZIP baseline completado más reciente y su sidecar presentes en Fuentes del Proyecto. Verifica integridad y ejecuta primero `node implementation-control/scripts/Validate-ControlPlaneState.mjs .`; solo continúa con salida 0. Después confirma `IMPLEMENTATION_STATE.json`, `AUTHORITY_MATRIX.json` y `TASK_SOURCE_LOCK.json`. Ejecuta únicamente `nextAuthorizedBatchId` conforme a `specdev-prompts/speckit.implement-batch.md` y al archivo `implementation-control/batches/Bxx.json`.

Respeta las raíces de composición definidas por AUTH-027 y las políticas exactas de cada autoridad. No modifiques `.specify`, no cargues tareas futuras y no inicies el lote siguiente.

Si el entorno permite ejecutar todos los comandos `localValidation.commands`, marca `[X]` solo con salida 0 y entrega un baseline completo. Si npm o Chromium no pueden ejecutarse, no marques las tareas: usa `IMPLEMENTED_PENDING_VALIDATION`, deja el lote `LOCAL_VALIDATION_REQUIRED` y entrega un ZIP candidato únicamente para adjuntar al chat junto con instrucciones de validación local. Un candidato nunca reemplaza Fuentes del Proyecto.

Al cerrar un lote validado, devuelve el ZIP completo limpio, su sidecar, evidencia incorporada, informe del lote e instrucciones exactas de reemplazo. Mantén `convergenceAuthorized=false`.
Usa GitHub-first: crea rama temática desde `main`, abre PR draft, ejecuta `FinScope PR Validation / validate`, registra candidate SHA/run/artifact en `GITHUB_HANDOFF.json`, aplica cierre allowlist, exige `FinScope Closure Validation / verify-closure` PASS y solo entonces merge/Release. Sigue `GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md` y conserva `convergenceAuthorized=false`.
