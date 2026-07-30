# FinScope Analytics v0.21.3 — Protocolo de implementación por lotes

## 1. Autoridad y alcance

Este protocolo organiza ejecución; no modifica Constitución, gate, requisitos ni autoridades de producto. La autoridad por campo está en `AUTHORITY_MATRIX.json`. Cada conversación trabaja exactamente el lote indicado por `IMPLEMENTATION_STATE.json`; la implementación monolítica y el inicio del lote siguiente están prohibidos.

`tasks.md` es la autoridad de definición de tareas. Los objetos copiados en `batches/Bxx.json` son espejos derivados y deben coincidir con `TASK_SOURCE_LOCK.json`; ante drift se detiene con `TASK_MIRROR_MISMATCH`.

La segregación de funciones y los handoffs se rigen por `SDD_OPERATING_MODEL.md`; el contexto estable/volátil y la gestión flexible de cambios se rigen por `CONTEXT_MAINTENANCE_MODEL.md`. Ambos son complementos operativos subordinados a este protocolo y a la matriz de autoridad.

## 2. Precondiciones del baseline

Antes de escribir:

1. verificar ZIP y sidecar, CRC, raíz única, extracción segura, rutas Windows, duplicados/case-fold y ausencia de symlinks peligrosos;
2. validar UTF-8, JSON/YAML, schemas operativos, manifiesto, inventario y metadata;
3. confirmar ausencia de secretos, temporales, builds, caches, dependencias instaladas y ZIPs anidados;
4. comparar los 19 archivos `.specify` y `specifyTreeSha256`;
5. leer `AUTHORITY_MATRIX.json` y confirmar el gate activo;
6. confirmar que el lote solicitado coincide con `activeBatchId`, no hay otro lote `IN_PROGRESS` y todas las dependencias externas están `COMPLETED`;
7. ejecutar `node implementation-control/scripts/Validate-ControlPlaneState.mjs .` y validar `TASK_SOURCE_LOCK.json`, los 109 hashes de tarea, los 25 hashes de batch, el mapa y el estado; cualquier salida no cero produce `TASK_MIRROR_MISMATCH`;
8. comprobar que cada archivo de prueba declarado es descubrible por Vitest o Playwright;
9. evaluar capacidades reales del entorno: Node/npm, acceso al registro, dependencias, Chromium y comandos requeridos.

Un incumplimiento físico produce `BASELINE_INVALID`; uno operativo produce `BATCH_PRECONDITION_FAILED`; drift de autoridad produce `AUTHORITY_CONFLICT`. Ninguno autoriza modificaciones de producto.

## 3. Modos de cierre

### 3.1 Cierre ejecutable directo

Solo cuando el entorno puede ejecutar todas las pruebas obligatorias. Se implementa, valida y cierra el lote en la misma conversación.

### 3.2 Autoría candidata con validación local delegada

Modo obligatorio cuando npm, Chromium, Cloudflare tooling u otra prueba necesaria no puede ejecutarse de forma confiable en ChatGPT.

1. Implementar únicamente el lote activo y ejecutar todas las validaciones estáticas disponibles.
2. No marcar tareas `[X]`.
3. Marcar tareas implementadas como `IMPLEMENTED_PENDING_VALIDATION` y lote como `LOCAL_VALIDATION_REQUIRED` dentro del candidato.
4. Mantener `activeBatchId` y `nextAuthorizedBatchId` en el mismo lote; el lote siguiente permanece `PENDING`.
5. Generar ZIP candidato, sidecar, reporte y comandos de `localValidation` del batch.
6. El candidato se adjunta al chat, no a Fuentes del Proyecto.
7. El usuario ejecuta `LOCAL_VALIDATION_PROTOCOL.md` y aporta el bundle de evidencia.
8. Un chat nuevo verifica candidato + sidecar + evidencia. Solo entonces marca `[X]`, cierra el lote y emite un baseline `*_completed.zip` que reemplaza al anterior en Fuentes.

Un fallo local produce una nueva revisión candidata del mismo lote. El baseline activo anterior nunca se sustituye por un candidato fallido.

## 4. Carga de contexto

Aplicar `CONTEXT_LOADING_POLICY.md` y `CONTEXT_MAINTENANCE_MODEL.md`. Abrir el batch individual y los fragmentos exactos de tareas/autoridades. No usar reportes derivados para decidir comportamiento. Para B02 deben cargarse también `decisions/ui-framework.md` y `contracts/schema-validation-runtime.md`.

## 5. Ejecución por tarea

En `executionOrder`:

1. verificar dependencias y hash de la tarea;
2. abrir requisitos, AC, `primaryAuthorityRefs`, fixtures y contratos exactos;
3. inspeccionar los archivos reales y los composition roots aplicables;
4. implementar solo los archivos declarados;
5. crear/actualizar pruebas declaradas y confirmar su descubrimiento;
6. ejecutar prueba específica, typecheck y regresión exigida por `localValidation`;
7. demostrar `doneWhen` con salida ejecutable o dejar pendiente de validación;
8. registrar archivos y evidencia.

Una tarea `[P]` solo puede ejecutarse después de todas sus dependencias y sin colisión de archivos/composition roots.

### 5.1 Autovalidación del plano de control

Todo cambio que cree o modifique tests de control, configuración de runners, scripts de validación, schemas operativos, locks de tareas o mirrors de lotes debe ejecutar y registrar la regresión completa afectada antes de promover un baseline activo o `completed`. La inspección estática por sí sola no permite cerrar esos cambios.
Toda mutación de `batches/Bxx.json`, incluso un cambio de estado derivado, obliga a recalcular su hash completo en `TASK_SOURCE_LOCK.json` antes de generar inventario, manifiesto o ZIP. El test `control-plane-integrity.test.ts` y el validador Node deben pasar en el candidato exacto.

Una ruta de prueba puede ser referenciada por varias tareas cuando todas resuelven al mismo runner; existe conflicto únicamente si la ruta se asigna a categorías de ejecución incompatibles.

### 5.2 Integridad de la evidencia ejecutable

La evidencia local debe quedar vinculada al ZIP exacto antes de ejecutar npm: nombre lógico, SHA-256 real, SHA esperado del sidecar, coincidencia del sidecar, raíz única, lectura CRC, rutas seguras, ausencia de symlinks/colisiones/ZIPs anidados y correspondencia byte a byte entre el archivo y la extracción. También debe validar manifiesto, inventario, metadata, `tasks.md`, `.specify` y archivos objetivo.

Debe registrar sistema operativo, arquitectura, PowerShell, Node y npm; todos los comandos del batch en su orden normativo; hora inicial/final, duración, exit code, logs completos y hashes de logs. Tras un fallo secuencial, cada comando restante se registra como `NOT_RUN` con motivo explícito. Los switches de omisión producen evidencia `FAIL`; nunca permiten cierre.

No se acepta como PASS una suite obligatoria que no descubra su archivo esperado, que use `--pass-with-no-tests`, que deje tests requeridos en estado skipped/omitted o que oculte un fallo mediante reintentos. La validación debe demostrar que `.specify`, `tasks.md` y los archivos objetivo permanecieron invariantes durante la ejecución.

## 6. Fallos

- Prueba obligatoria fallida: tarea no completada.
- Fallo secuencial: detener tarea y dependientes.
- Falta de runtime, red o navegador: no es PASS; usar `LOCAL_VALIDATION_REQUIRED`.
- No debilitar schemas, contratos, fixtures, AC ni checks para obtener PASS.
- No fabricar lockfiles, logs, hashes, resultados o evidencia.

Estados de lote: `PENDING`, `IN_PROGRESS`, `LOCAL_VALIDATION_REQUIRED`, `COMPLETED`, `PARTIAL`, `BLOCKED`.
Estados de tarea: `PENDING`, `IN_PROGRESS`, `IMPLEMENTED_PENDING_VALIDATION`, `COMPLETED`, `BLOCKED`.

## 7. Actualizaciones permitidas

Tras un lote/candidato:

- código, pruebas y documentación autorizados por sus tareas;
- casillas de `tasks.md` solo para tareas `COMPLETED`;
- `IMPLEMENTATION_STATE.json`, batch/map mirrors, `TASK_SOURCE_LOCK.json` si la definición autorizada cambió;
- `CHANGE_LEDGER.md`, reporte de lote y evidencia normalizada;
- metadata, inventario y manifiesto.

No modificar `.specify`. Una corrección de tarea/autoridad fuera de un lote requiere remediación documental explícita, reanálisis del DAG y paquete completo, como v0.21.2.

## 8. Cierre

B25 solo cierra después de B01–B24. T109 produce `docs/convergence-input.md`; luego `implementationStatus=COMPLETED`, `activeBatchId=null` y `convergenceAuthorized=false`. Convergencia requiere chat nuevo y transición formal del gate.
## 9. GitHub-first

El método primario para lotes posteriores a GH0 es rama temática → PR draft → `FinScope PR Validation` → candidato exacto → cierre allowlist → `FinScope Closure Validation` → merge autorizado → Release completed. Los comandos se derivan de `batches/Bxx.json`. `LOCAL_VALIDATION_PROTOCOL.md` se usa solo como fallback documentado. Toda instrucción al operador sigue `GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md`.
