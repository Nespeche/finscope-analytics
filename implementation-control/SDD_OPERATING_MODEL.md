# Modelo operativo de Spec-Driven Development

**Versión:** 1.0.0  
**Ámbito:** gobierno del trabajo, segregación de funciones y handoffs  
**No sustituye:** Constitución, `V0.21_PHASE_STATUS.md`, `AUTHORITY_MATRIX.json`, `spec.md`, `tasks.md` ni `IMPLEMENTATION_STATE.json`

## 1. Secuencia obligatoria

El flujo de FinScope conserva este orden sin saltos:

`constitución → especificación → aclaración → plan → checklist → tareas → análisis → implementación → convergencia`

Cada fase consume artefactos cerrados de la fase anterior, produce una salida verificable y solo puede abrir el gate siguiente mediante la autoridad de fase. La existencia de un archivo no equivale a autorización ni a finalización.

| Fase | Entrada mínima | Salida verificable | Función responsable | Función de control |
|---|---|---|---|---|
| Constitución | necesidad de gobierno | principios, límites y orden de gates versionados | custodio constitucional | revisor de impacto normativo |
| Especificación | Constitución vigente | FR/NFR, alcance y criterios observables | responsable de requisitos | revisor de trazabilidad |
| Aclaración | ambigüedades registradas | decisiones cerradas y texto corregido | analista de especificación | responsable de requisitos |
| Plan | especificación aclarada | arquitectura, contratos, datos y estrategia de prueba | responsable de arquitectura | revisor de ejecutabilidad |
| Checklist | spec/plan cerrados | dictamen independiente y hallazgos clasificados | revisor QA independiente | dueño del gate de tareas |
| Tareas | checklist aprobado | DAG, archivos, pruebas y Done when sin huecos | planificador de tareas | revisor de cobertura |
| Análisis | tareas completas | diagnóstico transversal sin bloqueantes ocultos | auditor de consistencia | dueño del gate de implementación |
| Implementación | gates abiertos y lote activo | código, pruebas, evidencia y paquete candidato/completado | implementador del lote | ejecutor y verificador de validación |
| Convergencia | T001–T109 y T109 cerradas | integración/release bajo autorización separada | revisor de convergencia | dueño del gate de convergencia |

## 2. Funciones y responsabilidades

Las funciones son responsabilidades operativas; no implican agentes secundarios ni herramientas autónomas.

### 2.1 Custodio del baseline

- verifica ZIP, sidecar, CRC, extracción segura, raíz, manifiesto, inventario, metadata y `.specify`;
- mantiene un único baseline `completed` activo en Fuentes del Proyecto;
- nunca promueve un candidato por declaración verbal o por evidencia parcial.

### 2.2 Responsable de autoridad de producto

- modifica únicamente la autoridad del campo correspondiente;
- registra el impacto sobre FR/NFR/AC, contratos, schemas, fixtures y tareas;
- evita que reportes, metadata o contexto conversacional creen requisitos nuevos.

### 2.3 Dueño del gate

- lee el phase status activo identificado por `DOCUMENTATION_INDEX.md`;
- abre o cierra solo el gate que controla;
- exige evidencia de la fase inmediatamente anterior.

### 2.4 Planificador de tareas

- deriva tareas de autoridades vigentes, no de código existente;
- fija dependencia, archivos, pruebas y Done when;
- conserva el lock de origen y el DAG acíclico.

### 2.5 Implementador del lote

- trabaja un solo lote y no más de seis tareas salvo subdivisión válida entre tareas;
- implementa solo archivos autorizados o una remediación de control explícitamente documentada;
- no marca `[X]` sin todas las pruebas obligatorias en PASS.

### 2.6 Ejecutor de validación local

- usa una extracción limpia e inmutable del candidato exacto;
- ejecuta el script sin switches de omisión para evidencia promocionable;
- devuelve candidato, sidecar y bundle de evidencia completo, también cuando el resultado sea FAIL.

### 2.7 Verificador de evidencia

- opera en una conversación posterior e independiente del cierre;
- verifica procedencia criptográfica, schema, comandos, logs, discovery, exit codes y hashes antes/después;
- no sustituye evidencia ausente con capturas, memoria o afirmaciones.

### 2.8 Revisor de convergencia

- actúa solo cuando `convergenceAuthorized=true`;
- verifica integración completa, T109, seguridad, accesibilidad, performance y estado `COMPLETED`;
- no usa la implementación de un lote para abrir convergencia implícitamente.

### 2.9 Custodio de contexto

- mantiene índice, matriz, estado, lote, ledger, reporte y handoff sincronizados;
- separa contexto estable, estado volátil, evidencia e históricos;
- nunca usa el chat como única fuente de continuidad.

## 3. Segregación mínima de funciones

1. El implementador puede producir un candidato, pero no convertir un PASS no adjunto en baseline completado.
2. El ejecutor local no edita el árbol validado ni reemplaza comandos fallidos con ejecuciones manuales.
3. El verificador de evidencia no infiere comandos, versiones o hashes ausentes.
4. El dueño del gate no amplía alcance mediante un reporte o un mirror.
5. La convergencia ocurre en otra conversación y con autorización expresa.

La misma persona puede desempeñar varias funciones, pero debe conservar los handoffs, evidencias y controles como si fueran revisiones independientes.

## 4. Ciclo de vida de artefactos

| Clase | Uso | Puede gobernar trabajo actual |
|---|---|---|
| `ACTIVE_NORMATIVE` | Constitución, requisitos y autoridades primarias | sí, dentro de su campo |
| `ACTIVE_GATE` | phase status vigente | sí, solo flags de autorización |
| `ACTIVE_OPERATIONAL` | matriz, protocolo, estado, lock, batch y política | sí, dentro de su campo |
| `CANDIDATE` | paquete pendiente de evidencia/promoción | no reemplaza baseline |
| `GENERATED_DERIVATIVE` | metadata, inventario, manifiesto, mapas y mirrors | no amplía autoridades |
| `HISTORICAL_EVIDENCE` | estados, checklists y reportes previos | no |
| `FROZEN_INFRASTRUCTURE` | `.specify` y prompts upstream preservados | solo infraestructura expresamente autorizada |
| `PLANNED_NOT_YET_REACHABLE` | scaffolding o dependencia asignada a tareas futuras | no se elimina por falta de uso actual |

## 5. Regla de cambio progresivo

Toda mejora sigue esta secuencia:

1. identificar el campo afectado y su autoridad;
2. registrar problema, riesgo y criterio de aceptación;
3. decidir si la mejora cabe en el lote activo o requiere una tarea futura;
4. modificar primero la autoridad competente cuando cambia comportamiento normativo;
5. actualizar código/pruebas y luego derivados operativos;
6. ejecutar regresión específica, regresión afectada y build;
7. emitir candidato cuando falte evidencia ejecutable;
8. promover solo tras verificación independiente del bundle.

Un hallazgo no bloqueante se conserva en el estado con dueño, condición de cierre y lote recomendado. Un hallazgo bloqueante detiene únicamente el alcance afectado.
