# Modelo profesional de mantenimiento de contexto

**Versión:** 1.0.0  
**Objetivo:** conservar continuidad verificable sin inmovilizar el proyecto ante cambios legítimos

## 1. Principio rector

El contexto debe ser **derivable de archivos autoritativos**, no de memoria conversacional. La flexibilidad se obtiene mediante cambios versionados y trazables; no mediante duplicar el estado en múltiples narrativas.

## 2. Capas de contexto

| Capa | Contenido | Volatilidad | Fuente |
|---|---|---:|---|
| C0 — identidad | ZIP completado activo, sidecar, raíz y hash `.specify` | muy baja | Fuentes + `PACKAGE_METADATA.json` |
| C1 — producto | Constitución, spec, aclaración, plan, primary authorities | baja | autoridades normativas |
| C2 — gates | fase autorizada y límites | baja | phase status activo |
| C3 — operación | estado, lote, lock, protocolo, política | alta | `implementation-control/` |
| C4 — trabajo | código, pruebas, fixtures y dependencias inmediatas del lote | alta | batch y tasks |
| C5 — evidencia | logs, bundles, reportes, hashes y resultados | alta | evidencia externa + reportes |
| C6 — historia | versiones, reportes y estados superados | acumulativa | archivos históricos |

Cada conversación carga solo las capas necesarias. Una auditoría puede recorrer todo el árbol; una implementación de lote carga C0–C5 de forma acotada.

## 3. Paquete mínimo de continuidad

Un handoff profesional debe contener exactamente:

- baseline completado de entrada y SHA-256;
- candidato actual y SHA-256, cuando exista;
- gates efectivos y fuente del gate;
- `activeBatchId`, estado del lote y tareas afectadas;
- SHA-256 de `tasks.md`, lock y hash canónico `.specify`;
- autoridades primarias realmente usadas;
- archivos modificados y pruebas requeridas/ejecutadas;
- bundle de evidencia y resultado verificable;
- hallazgos abiertos con severidad, dueño, condición de cierre y lote recomendado;
- próximo paso permitido y acciones expresamente prohibidas.

`SESSION_HANDOFF_TEMPLATE.md` materializa este paquete. Un chat posterior debe poder continuar sin leer la conversación anterior.

## 4. Gestión flexible de cambios

Cuando aparece una mejora o cambio de alcance:

1. **Propuesta:** describir problema, resultado esperado y alternativas.
2. **Impacto por campo:** identificar Constitución, FR/NFR/AC, primary authority, tareas, tests, datos y gates afectados.
3. **Decisión:** registrar aceptación, rechazo o diferimiento; no editar derivados antes de la autoridad.
4. **Plan de migración:** indicar compatibilidad, datos, deprecaciones y rollback.
5. **Implementación incremental:** aplicar en un lote autorizado con pruebas de no regresión.
6. **Evidencia:** producir candidato y validación reproducible.
7. **Promoción:** actualizar baseline completado y retirar únicamente el baseline anterior de Fuentes.
8. **Archivo:** mover narrativas superadas a histórico sin borrar trazabilidad.

Los cambios que no alteran requisitos pueden resolverse como remediaciones de ejecutabilidad o control, siempre que se documenten, no debiliten gates y ejecuten la regresión completa afectada.

## 5. Higiene para evitar deriva de contexto

- Mantener una sola autoridad por campo y tratar mirrors como derivados.
- Incluir en documentos activos un bloque explícito de estado o una referencia al estado, nunca ambos con valores independientes.
- No copiar listas completas de tareas en reportes; referenciar IDs y hashes.
- Marcar todo reporte anterior como histórico o cerrado.
- Separar hallazgos `OPEN`, `REMEDIATED_PENDING_VALIDATION`, `CLOSED` y `ACCEPTED_RISK`.
- No mezclar evidencia de candidatos distintos.
- Evitar fechas relativas; usar fecha ISO y revisión de paquete.
- Registrar deprecaciones con reemplazo, fecha/condición de retiro y prueba de ausencia de consumidores.

## 6. Política de código aparentemente no usado

Antes de eliminar un archivo sin imports directos, comprobar en este orden:

1. ¿es autoridad, schema, fixture, migration, asset estático o configuración descubierta por glob?;
2. ¿está asignado a una tarea futura en `tasks.md` o a un batch mirror?;
3. ¿es helper de un runner futuro o evidencia histórica requerida?;
4. ¿lo referencia un script, manifiesto, OpenAPI, JSON `$ref`, HTML, Vite, Wrangler o una ruta declarativa?;
5. ¿su eliminación conserva typecheck, discovery, schemas, regresión y build?

Solo se elimina cuando todas las respuestas son negativas y existe evidencia de regresión. De lo contrario se clasifica como `PLANNED_NOT_YET_REACHABLE`, `HISTORICAL_EVIDENCE` o `FROZEN_INFRASTRUCTURE`.

## 7. Cadencia de actualización

Actualizar el contexto operativo:

- al iniciar un lote;
- después de cada cambio material de autoridad o control;
- al emitir cada candidato;
- después de validar evidencia;
- al cerrar un lote;
- antes de cualquier promoción a `completed`.

En cada punto deben sincronizarse estado, mapa, lock, batch, ledger, reportes, metadata, inventario y manifiesto, manteniendo `convergenceAuthorized=false` hasta su transición formal.
## Continuidad GitHub

Cargar `GITHUB_HANDOFF.json` junto con `IMPLEMENTATION_STATE.json`. Registrar rama, PR, candidate SHA, run, artifact, cierre y Release. Toda devolución al usuario debe seguir `GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md`.
