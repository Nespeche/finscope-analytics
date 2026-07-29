# Política de carga de contexto v0.21.3

## Objetivo

Aplicar junto con `CONTEXT_MAINTENANCE_MODEL.md`, que define capas de contexto, handoff, ciclo de cambios y clasificación de artefactos.

Mantener contexto acotado sin perder autoridad, composición ni ejecutabilidad.

## Siempre cargar

1. `START_HERE_CHATGPT.md`;
2. `PROJECT_CONTEXT.md`;
3. `.specify/memory/constitution.md`;
4. `V0.21_PHASE_STATUS.md`;
5. `DOCUMENTATION_INDEX.md`;
6. `AUTHORITY_MATRIX.json`;
7. `IMPLEMENTATION_EXECUTION_PROTOCOL.md`;
8. este archivo;
9. `IMPLEMENTATION_STATE.json`;
10. `TASK_SOURCE_LOCK.json` y salida `PASS` de `Validate-ControlPlaneState.mjs`;
11. `IMPLEMENTATION_BATCH_MAP.json` solo para resolver `batchFile`;
12. `batches/Bxx.json` activo;
13. reporte del lote anterior.

## Cargar por referencia

- línea exacta de cada tarea en `tasks.md` y su hash;
- dependencias inmediatas y sus interfaces producidas;
- FR/NFR, AC, `authorityId`, `primaryAuthority`, `authorityRef` y `fixtureRef`;
- secciones relacionadas de `spec.md`/`plan.md`;
- composition roots afectados según `decisions/ui-framework.md`;
- archivos objetivo y pruebas existentes;
- `contracts/schema-validation-runtime.md` cuando se compilen/validen schemas;
- comandos de `localValidation` del lote.

## No cargar por defecto

- árbol textual completo durante implementación;
- informes históricos o candidatos previos no citados;
- matrices completas si basta el registro puntual;
- tareas futuras, fixtures ajenos o dominios no afectados;
- memoria de conversaciones como autoridad.

## Umbrales

- máximo normal: seis tareas;
- un dominio coherente por lote;
- subdividir solo entre tareas antes de escribir;
- nunca resumir una autoridad crítica si puede abrirse el fragmento exacto;
- no avanzar si los hashes de tarea/batch no coinciden.

## Resolución de conflictos

Usar autoridad por campo, no una lista plana. Constitución gobierna reglas; el phase status gobierna gates; primary authorities gobiernan comportamiento; `tasks.md` gobierna definición; `IMPLEMENTATION_STATE.json` gobierna estado corriente. Un espejo desactualizado se corrige y nunca prevalece.

## Ciclo de vida y ruido histórico

Clasificar archivos como activos, candidatos, derivados, históricos, infraestructura congelada o planificados antes de cargarlos semánticamente. Los históricos pueden inspeccionarse estructuralmente sin entrar en el contexto operativo salvo que una autoridad activa los referencie de forma expresa.
