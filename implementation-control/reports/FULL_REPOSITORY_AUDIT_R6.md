# Auditoría integral del repositorio y del modelo Spec-Driven — r6

**Fecha:** 2026-07-22  
**Baseline normativo activo:** `v0.21.2_authority_alignment_ready`  
**Paquete auditado de continuidad:** candidato r5  
**Salida:** `v0.21.2_B02_local_validation_candidate_r6`  
**Decisión:** `LOCAL_VALIDATION_REQUIRED`

## 1. Alcance y método

La auditoría cubre todo el árbol del paquete. Para cada archivo se realizó o registró:

- ruta, tamaño, SHA-256, UTF-8/formato y ciclo de vida;
- condición de autoridad, mirror, fixture, código, test, configuración, herramienta, evidencia o histórico;
- consumo directo, consumo declarativo, asignación a tareas o ausencia de uso actual;
- evaluación conservadora de obsolescencia y acción recomendada.

Se leyó semánticamente de forma integral la entrada, contexto, Constitución, gate activo, índice, matriz de autoridad, protocolo, política, estado, mapa, lock, 25 batches, 109 tareas, reportes activos, autoridades afectadas, código, configuraciones y pruebas. Los reportes y phase status históricos se inspeccionaron estructuralmente y se clasificaron; no se usaron para completar autoridades activas.

El detalle machine-readable por archivo está en `FULL_REPOSITORY_AUDIT_R6.json`.

## 2. Integridad y cadena de custodia

### Baseline completado

- ZIP: `FinScope_Analytics_SpecDev_ChatGPT_v0.21.2_authority_alignment_ready.zip`;
- SHA-256: `811436f2e00c34e78ff0a547c6e5364ed518ad40475304aca121399e52fde1d9`;
- sidecar, CRC, raíz única, extracción segura, rutas Windows, symlinks, colisiones case-fold y ZIPs anidados: PASS.

### Candidato r5 de entrada

- SHA-256: `c165bb8b0b6c4b8457087a3731552791de408eb3bceee9cadf9f5c384550559d`;
- integridad física y auditoría de paquete: PASS;
- estado normativo: candidato, no baseline completado.

El usuario informó PASS de la validación integral externa de r5. No se adjuntó el bundle generado por el script, por lo que no se verificó procedencia, comandos, logs ni hashes finales y no se promovió el candidato. r6 modifica archivos ejecutables y requiere evidencia propia.

## 3. Inventario y ciclo de vida

El paquete r6 contiene 487 archivos en el árbol final, incluidos metadata, inventario y manifiesto:

- 19 archivos `.specify`, byte-inmutables;
- 306 documentos Markdown;
- 141 documentos JSON;
- 22 archivos TypeScript, 3 Svelte, 1 SQL, 1 PowerShell y 5 shell scripts;
- 203 reportes históricos bajo `specs/.../reports/`;
- 14 phase status históricos y un phase status activo;
- 25 mirrors de lotes y 7 schemas operativos.

La elevada proporción documental no es código muerto: refleja autoridades, fixtures, schemas y evidencia histórica. El problema principal era la falta de clasificación explícita, que hacía posible cargar información superada como contexto corriente.

## 4. Código obsoleto o no usado

### 4.1 Resultado

**No se encontró ningún módulo de producto cuya eliminación sea segura y beneficiosa en r6.**

La auditoría diferencia cuatro casos que una búsqueda simple de imports confundiría con dead code:

1. **Scaffolding planificado:** tabla de rutas gateway vacía, dependencias como `decimal.js`, helpers de accesibilidad y runners sin specs actuales. Están asignados a tareas futuras o contratos de composición.
2. **Consumo declarativo:** schemas JSON, fixtures, migrations, `_headers`, `_redirects`, globs Vite/Playwright/Vitest y `$ref` no necesariamente aparecen como imports estáticos.
3. **Infraestructura congelada:** `.specify` y prompts upstream deben preservarse por identidad/manifest, aunque las fases cerradas no se ejecuten.
4. **Evidencia histórica:** reportes y phase status anteriores no gobiernan el presente, pero conservan cadena de decisiones y no deben borrarse sin una política formal de archivo externo.

### 4.2 Elementos que parecían no usados y su clasificación

| Elemento | Apariencia | Diagnóstico | Acción |
|---|---|---|---|
| `tests/accessibility/axe.ts` | helper sin import actual | soporte de T006 y specs futuros | conservar, no contar como test ejecutado |
| `decimal.js` | dependencia aún sin import | asignada a T011 y arquitectura normativa | conservar versión exacta |
| `gatewayRouteTable=[]` | ruta vacía | superficie cerrada hasta T027 | conservar; no publicar endpoints implícitos |
| suites unit/negative/performance vacías | runners sin tests actuales | scaffolding para tareas futuras | conservar; nunca usar `passWithNoTests` como Done when |
| prompts de fases cerradas | no usados por implementación | archivos upstream registrados por manifest | clasificar `FROZEN_INFRASTRUCTURE` |
| reportes v0.6–v0.21 | no usados por runtime | evidencia histórica | excluir de contexto normal, no eliminar automáticamente |

### 4.3 Código realmente defectuoso detectado

No era código “muerto”, sino código **fuera de la validación o fuera de la composición**:

- el gateway TypeScript no era descubierto por su `tsconfig`;
- placements/plugins/estilos futuros no eran alcanzables desde la composición browser;
- un test cargaba el script de validación sin usar la variable.

Esos tres defectos fueron remediados en r6.

## 5. Hallazgos priorizados

### AUD-R6-001 — Worker typecheck vacío — HIGH — remediado pendiente de validación

`workers/sec-gateway/tsconfig.json` tenía `files: []` e `include: []`. El comando podía devolver PASS sin compilar el entrypoint. r6 incluye `src/**/*.ts`, extiende el scan de `any` al gateway y ejecutó `tsc -p workers/sec-gateway/tsconfig.json --noEmit` con PASS usando el compilador host 5.8.3. La versión bloqueada 7.0.2 queda sujeta a la validación local integral.

### AUD-R6-002 — Composition root incompleto — HIGH — remediado pendiente de validación

El contrato AUTH-027 requería componentes globales opt-in, cinco placements, plugins lifecycle/a11y y estilos automáticos. r5 solo cubría vistas/componentes y renderizaba `status`. Las tareas futuras T022/T060/T061/T081/T082/T083/T084/T085/T089 no podían cumplir Done when sin editar archivos fuera de su alcance. r6 completa esa raíz sin cambiar el comportamiento visible actual.

### CTL-R6-001 — Prueba de policy sin aserciones — MEDIUM — remediado

`validationScript` se leía pero no se verificaba. r6 comprueba las políticas de cero tests, skipped/pending, fail-fast y `NOT_RUN`.

### DOC-R6-001 — Narrativas activas contradictorias — HIGH — remediado

`plan.md` cerraba implementación en su sección final pese a abrirla en el encabezado; el phase status mostraba B02 `PENDING`; `docs/development.md` permitía switches que invalidan evidencia y declaraba una ubicación de logs ya inexistente. r6 remite el estado volátil a `IMPLEMENTATION_STATE.json` y alinea instrucciones.

### GOV-R6-001 — Roles y funciones implícitos — MEDIUM — remediado

La autoridad por campo era sólida, pero no existía una segregación explícita entre custodio del baseline, dueño del gate, implementador, ejecutor local, verificador de evidencia y revisor de convergencia. `SDD_OPERATING_MODEL.md` cierra ese hueco.

### CTX-R6-001 — Contexto flexible sin modelo de ciclo de vida — MEDIUM — remediado

Había estado y política de carga, pero no un modelo profesional para cambios, deprecaciones y capas de contexto. `CONTEXT_MAINTENANCE_MODEL.md` y el handoff ampliado lo incorporan.

### B02-V006 — PASS r5 no verificable con los insumos actuales — BLOCKING FOR PROMOTION — abierto

La afirmación de PASS es plausible y útil como restricción de no regresión, pero no sustituye el bundle exacto. r6 necesita su propia evidencia porque el árbol cambió.

### AUD-R6-003 — Hardening adicional del script — MEDIUM — diferido

El script actual es fuerte y se conserva para no romper el flujo validado, pero una revisión futura debería:

- exigir que el sidecar nombre exactamente el ZIP además de contener su hash;
- verificar el hash de `TASK_SOURCE_LOCK.json` y del mirror B02 antes de npm;
- validar el JSON de evidencia recién generado contra `local-validation-evidence.schema.json` antes de comprimir;
- registrar un hash final de todo el árbol fuente autorizado o una allowlist de mutaciones regenerables.

Debe hacerse en un cambio de control plane separado y con regresión integral, no dentro de un cierre ya informado como PASS.

### AUD-R6-004 — Tests fuera del typecheck estático — MEDIUM — diferido

El `tsconfig` de producto no incluye `tests/**/*.ts`. Vitest/Playwright transpilan y ejecutan los tests, pero una configuración `tsconfig.tests.json` con `typecheck:tests` reduciría errores de tipos en test code. Añadirla requiere actualizar comandos, tests y evidencia en un lote de infraestructura autorizado.

### CFG-R6-001 — D1 UUID de placeholder — MEDIUM BEFORE DEPLOYMENT — abierto no bloqueante para B02

`wrangler.jsonc` usa el UUID todo-cero como placeholder de una base D1 no provisionada. No es un secreto ni código obsoleto, pero un dry-run/deploy real debe exigir un identificador de entorno válido sin incorporarlo silenciosamente a un paquete público.

## 6. Evaluación del Spec-Driven Development

### 6.1 Orden

El orden constitucional es correcto y maduro. La checklist independiente antes de tareas y el análisis transversal antes de implementación reducen requisitos no ejecutables. La convergencia separada evita convertir una implementación parcial en release.

### 6.2 Esquematización

La matriz por campo resuelve el problema clásico de precedencia plana. `tasks.md` gobierna definición, el state gobierna continuidad y los batches son mirrors bloqueados por hash. La mejora r6 es explicitar que **rol, autoridad y evidencia son dimensiones distintas**:

- un implementador no es dueño del gate;
- un reporte no es autoridad;
- un ejecutor local no es verificador de procedencia;
- un candidato no es baseline;
- un archivo histórico no es contexto activo.

### 6.3 Inconsistencias detectadas

- duplicación de estado volátil en `plan.md`, phase status y docs;
- alcance futuro de composición no implementado pese a estar normado;
- typecheck nominal del Worker sin archivos;
- test de control con variable sin aserciones;
- prompts upstream de fases cerradas visibles sin clasificación de ciclo de vida.

Las primeras cuatro se remediaron. La última se resuelve mediante clasificación y política de carga; no se modifican los archivos upstream.

## 7. Generado, pendiente y errores sin resolver

### Generado/implementado

- B01 completo;
- shell Svelte, gateway cerrado, D1 migration, headers, registry/validator Ajv y tests B02;
- evidencia local 1.1.0 y script integral;
- remediaciones r6 de typecheck, composición, test policy y documentación;
- modelos SDD/contexto y auditoría por archivo.

### Pendiente inmediato

- ejecutar la validación integral r6;
- devolver candidato r6, sidecar y evidence ZIP;
- verificar el bundle en otro chat;
- solo entonces cerrar T004/T007/T008/T009/T012 y B02 mediante un paquete `completed`.

### Pendiente posterior

- B03–B25 según DAG;
- composición Web Worker y rutas gateway cuando sus tareas lo autoricen;
- tests unit/negative/performance/accessibility a medida que aparezcan sus archivos normativos;
- hardening diferido del script y typecheck de tests;
- reemplazo controlado del placeholder D1 antes de despliegue.

## 8. Mejoras recomendadas por prioridad

### Prioridad 0 — no romper el estado actual

1. validar r6 con el mismo script y sin switches;
2. no editar el árbol validado;
3. no promover sin bundle;
4. no iniciar B03.

### Prioridad 1 — avance progresivo

1. cerrar B02 con evidencia r6;
2. emitir un `completed` que sea nuevo baseline inmediato;
3. continuar un lote por conversación y máximo seis tareas;
4. mantener tests específicos + regresión + build en cada cierre.

### Prioridad 2 — control plane

1. sidecar filename binding, lock/mirror hash y self-validation del evidence JSON;
2. `tsconfig.tests.json` y typecheck separado de tests;
3. registro machine-readable de deprecaciones con reemplazo y condición de retiro;
4. generación automática de un context capsule desde autoridades, sin duplicar estado manualmente.

### Prioridad 3 — higiene histórica

Mantener reportes dentro del ZIP mientras sean parte de la evidencia requerida, pero excluirlos de la carga semántica normal. En una futura convergencia puede definirse un archivo histórico externo firmado, siempre que el baseline completado conserve referencias y hashes y la Constitución lo permita.

## 9. Modelo profesional de contexto

La continuidad recomendada es:

1. **C0 identidad:** baseline + sidecar + hashes;
2. **C1 producto:** autoridades estables;
3. **C2 gate:** phase status;
4. **C3 operación:** state/map/lock/batch/protocolo;
5. **C4 trabajo:** archivos y tests del lote;
6. **C5 evidencia:** bundle y reportes;
7. **C6 historia:** documentos superados.

Todo cambio debe tener impacto por campo, decisión, compatibilidad/rollback, lote, tests, candidato, evidencia y promoción. El handoff se guarda en archivos y no depende del chat.

## 10. Límites de esta devolución

Se ejecutaron validaciones estructurales, análisis estático y el proyecto TypeScript del gateway. Este entorno no ejecutó sobre r6 `npm ci`, Svelte compiler, Vitest, Playwright, build ni PowerShell integral. Por ello la salida es candidata y no se presenta como PASS ejecutable ni `completed`.
