# Control-plane hardening R1 — diagnóstico, remediación y cierre

**Revisión promovida:** `v0.21.3_B02_control_plane_hardening_completed`  
**Baseline fuente reemplazado:** `v0.21.2_B02_completed`  
**SHA-256 del baseline fuente:** `ac1078c9da0c5cd12d066683eb74d70ca6f2788cb0adc136e6bb13d0e236ab9a`  
**Candidato verificado:** `FinScope_Analytics_SpecDev_ChatGPT_v0.21.3_B02_control_plane_hardening_candidate_r1.zip`  
**SHA-256 del candidato:** `4da4412b15630093bad16328cff5beb76d9c38868dfa6df06cc1a95dfb2c4006`  
**Evidencia verificada:** `FinScope_control_plane_evidence_20260723-222845.zip`  
**SHA-256 de la evidencia:** `f346f87204842dff8cebb5ac51ae25b7ce07c81b4c5a0c82c822e91698914d0f`  
**Estado:** `COMPLETED`  
**B03:** pendiente, no iniciado  
**Convergencia:** no autorizada

## 1. Causa raíz

Las autoridades, gates e Instrucciones del Proyecto estaban alineados. La inconsistencia era física y derivada: los 25 hashes full-file de `implementation-control/batches/B01.json` a `B25.json` registrados en `TASK_SOURCE_LOCK.json` eran obsoletos. Los 109 hashes de líneas de `tasks.md`, el DAG, los IDs, dependencias, B03 y los gates eran correctos.

El proceso anterior permitía que una mutación derivada de los mirrors no recalculara sus hashes full-file. Además, un sufijo físico de descarga como `(1)` podía impedir localizar el ZIP aunque el hash y el nombre lógico fueran correctos.

## 2. Corrección aplicada

1. Recalculo de los 25 hashes full-file de lotes y corrección del SHA de tareas en el mirror Markdown.
2. Validador Node fail-closed de 109 hashes de tarea, 25 hashes de lote, mapa, estado, gates, metadata y `.specify`.
3. Prueba contractual preventiva para drift de lock/mirrors.
4. Binding estricto del nombre lógico del sidecar con tolerancia exclusiva a sufijos físicos de descarga.
5. Extracción limpia automática, comparación ZIP↔extracción byte a byte y evidencia autocontenida.
6. Schema y autovalidación Ajv de la evidencia.
7. Contabilidad del árbol fuente no regenerable y detención ante cualquier mutación.

## 3. Evidencia ejecutable

Las ocho etapas obligatorias finalizaron con exit code `0`: `npm ci`, Chromium, control plane, typecheck, contratos del plano de control, regresión Vitest, regresión browser y build. El validador registró 991/991 controles PASS; la auditoría independiente registró 61/61 controles PASS.

La prueba negativa independiente alteró deliberadamente un hash de lote en el lock, un hash de tarea, los bytes de B25 y el estado B03 del mapa. Las cuatro alteraciones fueron rechazadas con exit code no cero e identificador específico.

## 4. Alcance preservado

No se modificaron los 19 archivos `.specify`, `spec.md`, `tasks.md`, FR/NFR/AC, contratos funcionales, fixtures, código de producto, tests, runners, scripts, schemas operativos, dependencias ni comportamiento después del PASS. Las mutaciones de promoción se limitaron a estado, mirrors/hashes derivados, ledger, reportes, contexto, metadata, inventario y manifiesto.

## 5. Continuidad

B01 y B02 permanecen `COMPLETED`; B03 permanece `PENDING` y es el único lote siguiente. `activeBatchId=B03`, `nextAuthorizedBatchId=B03` y `convergenceAuthorized=false`.
