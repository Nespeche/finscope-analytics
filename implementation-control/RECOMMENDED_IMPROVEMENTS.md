# Registro acumulativo de mejoras recomendadas

## Propósito

Este documento registra mejoras recomendables, deudas documentales, riesgos no bloqueantes y oportunidades de optimización verificables detectadas durante la ejecución por lotes de FinScope Analytics.

## Carácter no normativo

`RECOMMENDED_IMPROVEMENTS.md` es exclusivamente informativo y no constituye una autoridad normativa. No modifica la Constitución, `spec.md`, FR, NFR, AC, `tasks.md`, gates, estados de autorización, dependencias, `IMPLEMENTATION_STATE.json`, `AUTHORITY_MATRIX.json` ni el batch activo. Tampoco autoriza implementaciones futuras, introduce requisitos nuevos, sustituye autoridades ni permite cerrar riesgos por inferencia. Cada entrada requiere una tarea, lote o remediación posterior expresamente autorizada antes de ser implementada.

## Reglas de mantenimiento

1. Registrar únicamente hallazgos reales, verificables y fuera del alcance autorizado del lote activo.
2. Asignar un ID estable `IMP-NNN`, evitar duplicados y separar causa, impacto y recomendación.
3. Enlazar archivos, evidencias o autoridades concretas; no registrar ideas especulativas, preferencias estéticas genéricas ni optimizaciones prematuras.
4. Crear toda entrada nueva con estado `OPEN`; cambiarla a `AUTHORIZED` solo mediante autorización expresa posterior.
5. No implementar la mejora dentro del lote que la detecta salvo autorización expresa.
6. Registrar en `implementation-control/CHANGE_LEDGER.md` toda alta, cambio de estado, sustitución, rechazo o resolución.
7. Estados permitidos: `OPEN`, `AUTHORIZED`, `IN_PROGRESS`, `RESOLVED`, `REJECTED`, `SUPERSEDED`.
8. La resolución exige evidencia que satisfaga el criterio verificable de la entrada; el registro no sustituye la evidencia ejecutable ni el plano de control.

## Índice de mejoras

| ID | Título | Categoría | Prioridad | Bloqueante | Estado | Origen |
|---|---|---|---|---|---|---|
| IMP-001 | Generalizar el protocolo de validación local | Documentación / plano de control | MEDIUM | No | OPEN | Preparación de B04 desde el baseline B03 completed |
| IMP-002 | Desacoplar la prueba de integridad del conteo dinámico | Pruebas / plano de control | HIGH | Sí, para promoción B04 | RESOLVED | Evidencia local fallida de `FS_B04_r1.zip` |
| IMP-003 | Registrar preflight AST explícito de runners | Infraestructura de validación | HIGH | No para B05; obligatorio en futuros handoffs | IN_PROGRESS | Verificación B05 v6 |

## Entradas detalladas

### IMP-001 — Generalizar el protocolo de validación local

- **ID estable:** `IMP-001`
- **Título:** Generalizar el protocolo de validación local
- **Fecha de detección:** 2026-07-25
- **Lote o conversación de origen:** Preparación de B04 desde el baseline B03 completed
- **Categoría:** Documentación / plano de control
- **Prioridad:** `MEDIUM`
- **Condición bloqueante:** No
- **Estado:** `OPEN`
- **Descripción verificable:** El protocolo conserva referencias históricas específicas a B02 y B03 que pueden generar confusión al validar lotes posteriores.
- **Evidencia o archivos relacionados:** `implementation-control/LOCAL_VALIDATION_PROTOCOL.md`
- **Impacto potencial:** Riesgo de que un operador reutilice nombres, comandos o supuestos específicos de lotes anteriores.
- **Recomendación:** Generalizar el protocolo para resolver el lote desde `activeBatchId`, `IMPLEMENTATION_STATE.json` y el mirror `batches/Bxx.json`, manteniendo intacta la semántica ejecutable vigente. La futura generalización debe exigir además:
  - separación obligatoria de `stdout` y `stderr`;
  - prohibición de interpretar texto de `stderr` como JSON;
  - nombres físicos que incluyan lote, revisión del candidato y versión del runner;
  - prohibición de reutilizar nombres genéricos;
  - sidecar SHA-256 obligatorio del runner;
  - bundle versionado del runner que incluya instrucciones de uso e identidad verificable.
- **Alcance que no debe modificarse:** En B04 no modificar el protocolo, los scripts de validación, runners, schemas ni comportamiento ejecutable.
- **Lote, fase o remediación sugerida:** Futura remediación documental o de infraestructura expresamente autorizada.
- **Criterio verificable de resolución:** Protocolo neutral respecto del número de lote, ejemplos parametrizados, compatibilidad con el script externo y regresión completa del plano de control.


### IMP-002 — Desacoplar la prueba de integridad del conteo dinámico

- **ID estable:** `IMP-002`
- **Título:** Desacoplar la prueba de integridad del conteo dinámico
- **Fecha de detección:** 2026-07-25
- **Lote o conversación de origen:** Verificación de la evidencia local fallida de `FS_B04_r1.zip`
- **Categoría:** Pruebas / plano de control
- **Prioridad:** `HIGH`
- **Condición bloqueante:** Sí, para la promoción de B04
- **Estado:** `RESOLVED`
- **Descripción verificable:** `tests/contract/control-plane-integrity.test.ts` fijaba `checkCount=991`. `Validate-ControlPlaneState.mjs` agrega una comprobación por cada dependencia externa del lote activo: B03 tenía cuatro y B04 tiene seis, por lo que el resultado válido cambió de 991 a 993 sin que existiera una inconsistencia del plano de control.
- **Evidencia o archivos relacionados:** `tests/contract/control-plane-integrity.test.ts`; `implementation-control/scripts/Validate-ControlPlaneState.mjs`; `implementation-control/batches/B03.json`; `implementation-control/batches/B04.json`; `FinScope_local_evidence_B04_20260725-104454.zip` (SHA-256 `d2e965c5cf24f2fc5f71d8098998169063c24fc71c1c3fd8af21d2b6aeedc58d`).
- **Impacto potencial:** Falsos negativos de regresión cada vez que el lote activo cambie a otro con distinto número de dependencias, aun cuando todas las comprobaciones reales sean PASS.
- **Recomendación:** Verificar invariantes semánticas: estado PASS, cero fallos/issues, igualdad entre `checkCount`, `passCount` y `checks.length`, IDs únicos y todas las entradas PASS; no fijar el total dinámico.
- **Alcance que no debe modificarse:** No cambiar el validador, schemas, gates, hashes de tareas, mirrors funcionales, FR/NFR/AC ni código de dominio B04 para acomodar la prueba.
- **Lote, fase o remediación sugerida:** Remediación autorizada de B04 candidato r2.
- **Criterio verificable de resolución:** El candidato exacto r2 pasa los siete comandos obligatorios, incluida la regresión Vitest completa y build, y la evidencia es verificada de forma independiente.
- **Resolución verificada:** `FS_B04_r2.zip` (SHA-256 `25382901dbd792c777d32eac7beab7c7bb6072578f576a7d09ac52a249a20501`) y `FinScope_local_evidence_B04_20260725-115856.zip` (SHA-256 `7477c4d05c983411245735ae77f25165c82dbe696e787e330c42fe111f065892`) demostraron los siete comandos PASS/exit 0, regresión completa 20 archivos/82 tests, build PASS y plano de control semántico PASS. El validador permaneció byte-idéntico al baseline B03.


### IMP-003 — Registrar preflight AST explícito de runners

- **ID estable:** `IMP-003`
- **Fecha de detección:** 2026-07-26
- **Categoría:** Infraestructura de validación
- **Prioridad:** `HIGH`
- **Condición bloqueante:** No para la promoción B05 ya autenticada; control obligatorio para futuros handoffs.
- **Estado:** `OPEN`
- **Descripción verificable:** `Run-FinScope-BatchValidation_B05_r1_v6.ps1` se ejecutó y produjo evidencia PASS, pero no contiene una llamada explícita a `System.Management.Automation.Language.Parser` ni un artefacto AST separado previo a npm.
- **Impacto potencial:** Un error sintáctico en un runner futuro puede impedir que el propio script genere evidencia diagnóstica.
- **Recomendación:** Añadir un launcher o etapa externa que analice el runner completo, registre errores AST y hash del archivo antes de cualquier npm.
- **Alcance no autorizado ahora:** No modificar v6, runners autenticados, protocolos, scripts o schemas durante el cierre B05.
- **Criterio de resolución:** nueva versión `rN_vM` autenticada, preflight AST registrado y regresión completa aplicable PASS.

## Historial de cambios del registro

| Fecha | Cambio | Entradas afectadas | Autoridad de la modificación |
|---|---|---|---|
| 2026-07-25 | Creación del registro no normativo e incorporación inicial. | IMP-001 | Excepción documental autorizada durante B04 |
| 2026-07-25 | Alta y remediación en curso del acoplamiento a un conteo dinámico detectado por evidencia r1. | IMP-002 | Solicitud expresa de análisis y solución de la falla B04 |
| 2026-07-25 | `IMP-002` marcado `RESOLVED` tras evidencia ejecutable completa del candidato r2 y verificación independiente fail-closed. | IMP-002 | Excepción de cierre B04 autorizada |
| 2026-07-25 | `IMP-001` ampliado con separación stdout/stderr, JSON solo desde stdout, nombres versionados, sidecar y bundle de runner; permanece `OPEN`. | IMP-001 | Autorización expresa del lote B05 |
| 2026-07-26 | Alta de `IMP-003` y vínculo con la memoria de confiabilidad B05; no modifica autoridades ni runner v6. | IMP-003 | Cierre documental B05 |


### IMP-004 — Validación de evidencia independiente de la limpieza de dependencias

- **Fecha de detección:** 2026-07-26
- **Origen:** evidencia B06 r2.
- **Prioridad:** `HIGH`.
- **Estado:** `RESOLVED`.
- **Descripción:** el runner r2 eliminó `node_modules` antes de invocar el validador Ajv del esquema de evidencia.
- **Remediación r3:** copiar temporalmente Ajv y su cierre exacto de dependencias fuera del árbol antes de limpiar, validar después de la limpieza y borrar el runtime temporal.
- **Criterio de resolución:** evidencia r3 PASS con `schemaValidation.status=PASS`, árbol restaurado y los 11 comandos PASS.


- **Evidencia de resolución:** `FinScope_local_evidence_B07_20260726-203511327.zip` (`8f34fca7807b71f56d1879bada5fed1713a9f3eb3f3d042820a03351ce100059`), 11/11 comandos PASS, schema de evidencia PASS, control plane inicial/final PASS y árbol restaurado.

### IMP-005 — Conformidad de esquemas operativos dentro del preflight

- **Fecha de detección:** 2026-07-26
- **Origen:** evidencia B06 r3.
- **Prioridad:** `BLOCKER` para cualquier promoción.
- **Estado:** `RESOLVED`.
- **Problema:** el control-plane comprobaba hashes, gates y mirrors, pero podía declarar PASS aunque un documento JSON violara su esquema operativo.
- **Remediación r4:** validador estructural sin dependencias para el subconjunto de JSON Schema usado por los documentos de control y los 25 lotes.
- **Criterio de resolución:** preflight r4 PASS, regresión Vitest PASS y evidencia completa PASS.

- **Evidencia de resolución:** `FinScope_local_evidence_B07_20260726-203511327.zip` (`8f34fca7807b71f56d1879bada5fed1713a9f3eb3f3d042820a03351ce100059`), 11/11 comandos PASS, schema de evidencia PASS, control plane inicial/final PASS y árbol restaurado.

| 2026-07-26 | `IMP-004` y `IMP-005` marcados `RESOLVED` por evidencia B07 r2 que reutiliza y valida los controles de runtime aislado y conformidad de schemas operativos. | IMP-004, IMP-005 | Cierre B07 autorizado |
