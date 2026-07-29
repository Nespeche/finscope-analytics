# Diagnóstico integral de autoridad, lotes y ejecutabilidad

## Dictamen

El problema principal no era un error aislado de T001 o T004. El baseline mezclaba tres capas sin una autoridad por campo: normativa de producto, orquestación de implementación y evidencia histórica. Esa mezcla permitía que documentos raíz obsoletos, batches derivados y reportes previos parecieran competir con `tasks.md`, el gate o el estado operativo.

La consecuencia práctica fue una cadena que podía ser documentalmente consistente y, al mismo tiempo, no ejecutable. T004 es el ejemplo determinante: debía crear un shell Svelte visible, pero no podía modificar `src/main.ts`, que seguía montando un párrafo con DOM puro. Cumplir el E2E exigía violar el alcance declarado o dejar componentes sin conexión.

## Causas raíz

### 1. Precedencia plana y contradictoria

`DOCUMENTATION_INDEX.md` y la política de contexto ordenaban autoridades de forma distinta. Una lista plana no distingue quién gobierna gates, requisitos, comportamiento, definición de tarea o estado. Se reemplazó por `AUTHORITY_MATRIX.json`, con autoridad única por campo y procedimiento de conflicto.

### 2. Estado corriente duplicado y obsoleto

Entrada, contexto, índice y phase status todavía describían un paquete pre-B01, mientras `IMPLEMENTATION_STATE.json` ya registraba B01 completado y B02 activo. Los documentos activos se alinearon con v0.21.2; los anteriores quedaron explícitamente históricos.

### 3. Espejos de tarea sin lock

Los 25 batches copiaban contenido de `tasks.md`, pero no existía un hash que demostrara equivalencia. Un ajuste podía quedar solo en una copia. `TASK_SOURCE_LOCK.json` ahora fija el SHA-256 de `tasks.md`, cada línea T001–T109 y cada batch. Los batches incorporan `sourceTasksSha256` y `sourceTaskSha256`.

### 4. DAG con dependencias ficticias

T002, T003, T005, T006 y T010 aparecían paralelizables sin depender de T001, aunque sus comandos y tests requieren el árbol de dependencias y lockfile de T001. Esto hizo que un bloqueo de npm pareciera local cuando en realidad bloqueaba el arnés completo. Se añadieron dependencias causales y se recalcularon dependencias externas de los 25 lotes.

### 5. Alcance imposible de T004

T004 ahora autoriza `src/main.ts`, `App.svelte`, `app/composition.ts`, pruebas de composición, diagnóstico del compilador Svelte y E2E. Su `Done when` exige montaje real, home route registrada, diagnósticos Svelte limpios y landmarks alcanzables.

### 6. Módulos futuros sin raíces de composición

Las tareas podían crear vistas, acciones, plugins, estilos, runners Worker y rutas HTTP sin conectarlos a la aplicación. AUTH-027 define tres raíces: browser (`main → App → composition`), Worker (`orchestrator → operation-registry`) y gateway (`index → route table`). Las tareas afectadas ahora exigen `routeDefinition`, `appPlacement`, `installAppPlugin` o descriptor registrado.

### 7. Pruebas declaradas pero no descubiertas

Playwright tenía `testDir=tests/e2e`, por lo que no ejecutaba `tests/accessibility/` ni `tests/performance/`. Vitest tampoco tenía proyecto performance. Las configuraciones y scripts se corrigieron, y `tests/contract/test-discovery.test.ts` verifica que cada path ejecutable de los 109 tasks pertenece exactamente a un runner.

### 8. Política Ajv incompleta

T012 decía “Draft 2020-12 fail-closed” sin definir opciones strict, formatos ni excepciones para schemas compuestos. Esto produjo errores `strictRequired`/`strictTypes` durante intentos B02. AUTH-036 define Ajv2020, formatos determinísticos, prohibición de coerción/defaults/remoción y excepciones de lint acotadas que no relajan instancias.

### 9. Ausencia de estado candidato y cierre local

El protocolo solo contemplaba PASS o bloqueo, aunque ChatGPT puede editar sin acceso confiable a npm/Chromium. Se formalizaron `IMPLEMENTED_PENDING_VALIDATION` y `LOCAL_VALIDATION_REQUIRED`, comandos por lote, schema de evidencia y script PowerShell. Un candidato nunca reemplaza Fuentes.

### 10. Identidad de baseline ambigua

`sourceBaseline` mezclaba origen normativo e input inmediato. El estado ahora distingue el baseline completado de entrada B01 del origen normativo v0.21 y declara el rol del paquete.

## Estado de T001 y T004

- **T001:** continúa `COMPLETED`. Su problema histórico de registro npm fue real y quedó cerrado en B01. La remediación corrige la dependencia causal: ningún arnés/configuración se considera independiente de T001.
- **T004:** continúa `PENDING` dentro de B02. Ya no es imposible por alcance; no se marca completa porque esta revisión no implementa el shell.

## Resultado

Se preservan 109 tareas, 25 lotes, B01 completado, B02 único lote autorizado y `.specify` byte-inmutable. El paquete queda preparado para implementar B02 mediante cierre directo o candidato + validación local + promoción formal.
