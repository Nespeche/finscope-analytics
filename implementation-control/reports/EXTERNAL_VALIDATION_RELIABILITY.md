# Memoria de confiabilidad de validación externa

**Estado:** `NON_NORMATIVE_OPERATIONAL_CONTEXT`  
**Propósito:** memoria técnica, prevención de recurrencia y trazabilidad comprobable de incidentes de validación externa.  
**Alcance:** evidencia y contexto operativo; no constituye autoridad normativa.

Este documento **no reemplaza** `.specify/memory/constitution.md`, `spec.md`, `tasks.md`, el phase status activo, `implementation-control/AUTHORITY_MATRIX.json`, `implementation-control/batches/B05.json`, `implementation-control/TASK_SOURCE_LOCK.json` ni los protocolos y políticas activos. Ante contradicción prevalece la autoridad por campo definida por el paquete. Los reportes y esta memoria son evidencia/contexto, no autoridad normativa.

## 1. Identificación y fuentes autenticadas

| Elemento | Nombre visible o lógico | SHA-256 | Verificación |
|---|---|---|---|
| Baseline B04 visible | `FS_v0.21.5_B04_completed(4).zip` | `c7491391acda2aee2daee3d43f3b177285df32342d0146645bf499de1c3a3e06` | hash real y sidecar lógico coincidentes |
| Baseline B04 lógico | `FS_v0.21.5_B04_completed.zip` | `c7491391acda2aee2daee3d43f3b177285df32342d0146645bf499de1c3a3e06` | declarado por sidecar y metadata |
| Candidato B05 visible | `FS_B05_r1(3).zip` | `1532d0ac3d830c4e74bf3aeef6c7f8f342a3a2460706d04d2a13250d996ea3ad` | hash real y sidecar lógico coincidentes |
| Candidato B05 lógico | `FS_B05_r1.zip` | `1532d0ac3d830c4e74bf3aeef6c7f8f342a3a2460706d04d2a13250d996ea3ad` | vinculado por evidencia PASS |
| Runner defectuoso referido | `Run-FinScope-BatchValidation_B05_r1_v3.ps1` | `dfef6aaae23304729521c7870175db95cbafa7440ca6f42757c4c9564070e785` | **referenciado por el bug report; archivo no disponible, no verificado independientemente** |
| Runner corregido visible | `Run-FinScope-BatchValidation_B05_r1_v6(1).ps1` | `587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079` | archivo, sidecar y copia dentro de evidencia byte-idénticos |
| Runner corregido lógico | `Run-FinScope-BatchValidation_B05_r1_v6.ps1` | `587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079` | autenticado por sidecar y evidencia |
| Evidencia PASS | `FinScope_local_evidence_B05_20260725-232642920.zip` | `c7da945f9d9e705bec933156c9838d910ec5c46ca9fdbada20f30b5e8263fe4b` | ZIP, sidecar, CRC, inventario y manifiesto válidos |
| Bug report | `bug-report-INVALID_COMMAND_TIMESTAMP(1)(1).md` | `4e6e23cfc5cb95327f9beff389f9a5f3a4dd00eed0727517d5a5b6bfe8ac1c98` | fuente diagnóstica adjunta |

Archivos internos de evidencia autenticados:

| Archivo | SHA-256 |
|---|---|
| `runner/runtime-and-parser-self-tests.json` | `c90f78e06f6c46c12de44daac275ff73f948a947fb33f359b2143d2f17056a98` |
| `runner/command-policy-results.json` | `607d27f020b4cb6e4515a84589cdc3afe33b4872382ac132853d3604f436528a` |
| `runner/command-execution-context.json` | `818880dcb3481923d12df454f294b32ed5b1f1fe6b92bdd3cd4336913bac03b3` |
| `runner/precompression-self-verification.json` | `4c8fe83fc92e63e5926b84188054d3c82896775cad5822ccbed634bea4c37291` |
| `VERIFICATION_SUMMARY.json` | `a1a363ea0298650317b5754fc6ffbefcbe1436e64a964aecf40e57a863393545` |
| `B05-local-validation.json` | `11c4fb1e1388fc8d43e66fcecd35b6ee702fa0a3dbeef8c4a64b78268fd1e576` |
| `EVIDENCE_MANIFEST.sha256` | `513efe7d547fe1aeb7bf9ec0528becf306ecb8e80cc92c75fa20b4926c1b2de4` |
| `EVIDENCE_INVENTORY.json` | `072fac3097de04a4f2ff1dec1348752b5a059902f0ec0fb934f5da2e683822e3` |

No se adjuntó un JSON de preflight autónomo `FinScope_runner_preflight_B05_r1_v6_*.json`. Por tanto, ese artefacto separado queda **referenciado, no verificado independientemente**. Sí se verificaron los registros de preflight contenidos en la evidencia final: `runtime-and-parser-self-tests.json`, `structure-validation/json-validation.stdout.json`, `precompression-self-verification.json`, control plane inicial/final y `VERIFICATION_SUMMARY.json`.

## 2. Entorno observado

- PowerShell externo: `7.6.4`, `PSEdition=Core`; mínimo declarado por v6: `7.5.0`.
- Cultura efectiva externa: `CurrentCulture=es-AR`; `CurrentUICulture=es-MX`.
- Autopruebas culturales: `es-AR` y `en-US`.
- Entorno interno reportado: Windows `10.0.26200`, Node `v24.18.0`, npm `11.16.0`.
- El runner interno informó `PSEdition=Desktop` por una expresión fallback; la propia evidencia declara esta limitación y el runner externo autenticado normalizó la edición real como `Core`.

## 3. Síntoma original

El wrapper externo produjo `VALIDATION FAIL`, `commandPoliciesPass=false` y `INVALID_COMMAND_TIMESTAMP` para los comandos, aunque el candidato había ejecutado funcionalmente los comandos con exit code 0. El incidente fue un **falso negativo del wrapper de validación**, no un fallo funcional demostrado de la aplicación.

## 4. Causa raíz demostrada

1. El runner interno escribió timestamps ISO 8601 roundtrip válidos, por ejemplo `2026-07-25T22:08:16.5724751-03:00`.
2. En PowerShell `7.6.4`, `ConvertFrom-Json` podía convertir silenciosamente esos strings a `System.DateTime`.
3. Aplicar `[string]` al `DateTime` descartaba el texto ISO original y producía un texto dependiente de cultura, observado como `07/25/2026 22:08:16`.
4. `DateTimeOffset.Parse` sin cultura explícita usaba `CurrentCulture=es-AR`, que espera orden día/mes; `25` quedaba interpretado como mes y generaba `FormatException`.
5. El `catch` convertía el error de parseo del wrapper en `INVALID_COMMAND_TIMESTAMP`, generando falsos negativos para todos los comandos.

## 5. Corrección definitiva demostrada en v6

- `ConvertFrom-Json -DateKind String` preserva el texto JSON original para timestamps.
- El parseo exige forma ISO 8601 con offset y usa `InvariantCulture`; conserva semántica roundtrip.
- `ConvertTo-StrictDateTimeOffset` acepta controladamente `DateTimeOffset` y convierte `DateTime` a formato `o` invariant antes de validar.
- Se elimina la dependencia funcional de `CurrentCulture`.
- Las autopruebas cubren `es-AR` y `en-US`.
- Los JSON con claves vacías se procesan mediante una ruta específica con `-AsHashtable`; no se aplica indiscriminadamente a objetos que esperan `PSCustomObject`.
- El runner se autentica por SHA-256 y sidecar lógico antes de confiar en su ejecución.
- Existe preflight `-PreflightOnly` sin ejecución de npm, fail-fast y evidencia diagnóstica `_FAILED` ante errores posteriores a la autenticación del runner.
- Se separan stdout y stderr; los comandos, cwd, tiempos, exit codes y hashes de logs quedan registrados.

**Salvedad comprobada:** el archivo v6 no contiene una llamada explícita a `System.Management.Automation.Language.Parser` ni un artefacto AST independiente. Su ejecución PASS demuestra que PowerShell parseó sintácticamente el script completo, pero no prueba un preflight AST separado previo a npm. Este punto se registra como riesgo residual y control obligatorio para runners futuros; no se declara falsamente como implementado en v6.

## 6. Soluciones que no son definitivas

No deben considerarse correcciones permanentes:

- cambiar `CurrentCulture` a `en-US`;
- editar un runner sin generar nueva versión y sidecar;
- modificar manualmente JSON de evidencia;
- reutilizar el mismo nombre para un runner modificado;
- repetir npm sin corregir primero el wrapper;
- generar una nueva revisión del candidato cuando el candidato no cambió;
- promover evidencia PASS sin autenticar runner, candidato y sidecars.

## 7. Controles obligatorios para futuros runners

### A. Compatibilidad PowerShell

- Requerir `pwsh`/Core y versión mínima explícita.
- Registrar `PSVersion`, `PSEdition`, `CurrentCulture` y `CurrentUICulture`.
- Ejecutar y registrar un análisis AST completo del runner antes de npm.
- Evitar interpolaciones ambiguas como `"$variable:"`; usar `${variable}`.

### B. JSON y timestamps

- Preservar timestamps como strings cuando se valida el texto original.
- Exigir ISO 8601 roundtrip con offset, `InvariantCulture` y `startedAt <= finishedAt`.
- Rechazar timestamps vacíos, locales ambiguos o dependientes de cultura.
- Autoprobar `es-AR` y `en-US`.
- Usar `AsHashtable` cuando sea necesario preservar claves vacías; no usarlo si el código requiere `PSCustomObject`.

### C. Integridad

- Autenticar runner, sidecar, candidato y evidencia antes de confiar en contenido.
- Verificar nombre lógico y hash real.
- Registrar el SHA-256 del runner exacto dentro de la evidencia.
- Prohibir reutilización de nombres; usar `rN_vM`.
- Incrementar `rN` si cambia el candidato e incrementar `vM` si cambia solo el runner.

### D. Preflight

- Ejecutar primero una etapa sin npm.
- Validar CRC, raíz única, traversal, rutas absolutas, symlinks, duplicados/case-fold, UTF-8, JSON/YAML, schemas, manifiesto, inventario, metadata, secretos, temporales, builds, caches y ZIPs anidados.
- Verificar los 19 archivos `.specify`.
- Verificar batch, lock, hashes, tareas y gates.
- Comprobar Node, npm, scripts, descubrimiento de pruebas, dependencias y Chromium antes de comandos costosos.

### E. Ejecución

- Derivar `localValidation.commands` y `browserRequired` desde `batches/Bxx.json`.
- Registrar comando exacto, cwd, inicio, final, duración y exit code.
- Separar stdout y stderr, usar fail-fast y demostrar descubrimiento real.
- No declarar PASS por inspección estática.

### F. Evidencia y promoción

- Vincular evidencia al candidato y runner exactos; producir ZIP y sidecar.
- Distinguir claramente PASS y `_FAILED`.
- No reemplazar el último completed con un candidato.
- Mantener `activeBatchId` ante `LOCAL_VALIDATION_REQUIRED`.
- Promover solo tras verificación independiente; mantener `convergenceAuthorized=false`.
- Demostrar por allowlist que no hubo cambios funcionales posteriores a evidencia.

## 8. Checklist reutilizable

| Control | Momento | Criterio PASS | Evidencia esperada | Acción ante FAIL |
|---|---|---|---|---|
| Sintaxis AST | antes de toda lógica/npm | parser sin errores sobre runner completo | JSON/log de parser con hash del runner | abortar y emitir nueva `vM` |
| Hash del runner | inicio | archivo real = sidecar lógico único | SHA-256 y sidecar | abortar |
| PowerShell | inicio | Core y versión mínima | runtime record | abortar con diagnóstico |
| Cultura | inicio | culturas registradas; autopruebas `es-AR`/`en-US` | self-test JSON | abortar |
| Parseo ISO | preflight | strings preservados, offset y orden válidos | self-test + command policy | abortar |
| JSON con clave vacía | preflight | clave preservada por ruta `AsHashtable` | self-test | abortar |
| Candidato/sidecar | preflight | hash real y nombre lógico coinciden | candidate identity | abortar |
| CRC/extracción segura | preflight | CRC legible, raíz única, cero rutas inseguras | archive inspection | abortar |
| `.specify` | preflight y final | 19 archivos, hash canónico invariante | hashes before/after | abortar |
| `TASK_SOURCE_LOCK` | preflight | mirrors y hashes válidos | control-plane JSON | abortar |
| Test discovery | antes/tras ejecución | tests objetivo descubiertos y conteo positivo | command policy/logs | FAIL |
| Comandos | ejecución | lista idéntica a batch | command context | FAIL |
| cwd | ejecución | raíz extraída exacta | cwd proof | FAIL |
| Timestamps | ejecución | ISO, offset, orden y duración coherente | command evidence | FAIL |
| Exit codes | ejecución | 0 para cada obligatorio | evidence JSON | fail-fast |
| Inventario | precompresión/final | cobertura, tamaños y hashes exactos | inventory JSON | FAIL |
| Manifiesto | precompresión/final | cobertura y hashes exactos | manifest SHA-256 | FAIL |
| Metadata | preflight/final | identidad, estado y revisión coherentes | metadata + control plane | FAIL |
| Árbol final invariante | final | hash before = after | inspection summary | invalidar evidencia |
| ZIP evidencia/sidecar | final | CRC, safe paths, hash y nombre lógico válidos | ZIP + sidecar | no promover |

## 9. Registro específico B05

| Campo | Valor |
|---|---|
| Identificador | `B05-VALIDATION-001` |
| Clasificación | `VALIDATION_WRAPPER_FALSE_NEGATIVE` |
| Componente | outer PowerShell runner |
| Causa | culture-sensitive timestamp round-trip |
| Impacto | evidencia funcionalmente válida rechazada |
| Corrección | `Run-FinScope-BatchValidation_B05_r1_v6.ps1` (`587fbbe9f0339b0fb93d44f0be72f9697d5da26157063d4552eec4e65295a079`) |
| Resultado final | `PASS`, demostrado por `FinScope_local_evidence_B05_20260725-232642920.zip` (`c7da945f9d9e705bec933156c9838d910ec5c46ca9fdbada20f30b5e8263fe4b`) |
| Estado | `RESOLVED` |
| Riesgo de recurrencia | Medio si futuros runners omiten `DateKind String`, cultura invariant, versionado o AST explícito |
| Controles preventivos | autopruebas culturales, parseo ISO invariant, rutas JSON separadas, autenticación SHA-256, preflight sin npm, fail-fast, evidencia `_FAILED`, checklist heredable |

## 10. Estado de acciones

### Correcciones ya aplicadas

- preservación de timestamps como strings;
- parseo ISO invariant con offset;
- autopruebas `es-AR`/`en-US`;
- soporte controlado de claves vacías;
- autenticación de runner/candidato/evidencia;
- preflight sin npm, fail-fast, separación stdout/stderr y evidencia diagnóstica;
- nomenclatura versionada v6 sin modificar el candidato r1.

### Recomendaciones futuras no bloqueantes

- producir un artefacto AST explícito previo a npm;
- generalizar estos controles en el protocolo neutral por lote;
- corregir en una revisión autorizada el reporte interno erróneo de `PSEdition=Desktop`.

### Riesgos residuales

- un error sintáctico futuro puede impedir que el propio runner genere `_FAILED` si no existe un launcher/preflight AST externo;
- la ausencia del preflight JSON autónomo adjunto limita su verificación independiente, aunque la evidencia final PASS contiene controles equivalentes y completos para B05.

### Mejoras que requieren autorización normativa posterior

Cambiar runners, protocolos, scripts, schemas operativos, comandos normativos o contratos de evidencia exige autorización expresa y, cuando corresponda, regresión completa. Esta memoria no introduce esos cambios silenciosamente.

## 10. Incidente B06 r1: fallo funcional y fallo secundario del wrapper

Fuentes autenticadas: candidato r1 `b151f5a3...ba723`, runner r1 `9580eca8...ca5a`, evidencia FAIL `2571813d...da49b`, JSON core `665afdab...73ef` y diagnóstico secundario `d9b14003...d655f`.

- Preflight, hashes, extracción y control plane 994/994: PASS.
- Primer fallo funcional: `test-contract`, `SEC_URL_BLOCKED_BY_POLICY`.
- Causa: Company Concept recibió `CIK0000320193.json` como segmento; la autoridad exige `CIK0000320193`.
- Fallo secundario: el wrapper analizó salida ANSI y sustituyó el diagnóstico visible por `TEST_DISCOVERY_NOT_PROVEN: command=test-unit`, aunque el log registraba 1 archivo y 4 tests PASS.

Control preventivo r2: `Run-FinScope-BatchValidation_B06_r2_v1.ps1` (`2fa388fb0d6744a9d1f86d21e6a0c970294550ef9d6413fd9d6fdeb1812546d8`) unifica el flujo, resuelve aliases por sidecar/hash, ejecuta AST y autopruebas de parser, normaliza ANSI, deriva comandos desde B06, conserva `primaryFailure` y genera evidencia íntegra en PASS o FAIL. Su eficacia queda pendiente de validación ejecutable del candidato r2 exacto.



## 11. Incidente B06 r2 — ruta visual estática y Ajv eliminado antes del esquema

- Evidencia: `FinScope_local_evidence_B06_20260726-122752787_FAILED.zip` (`c73c994cee64dc9fc97838e1951d9b89ee02cf3bfd2f95c9c2480cb5e6052586`).
- Funcional: `test-e2e` falló en desktop/mobile porque la shell legacy no reemplazó la instancia de vista al cambiar `activeRoute`.
- Infraestructura: el runner preservó correctamente el fallo primario, pero su validación Ajv se ejecutó después de eliminar `node_modules`.
- Prevención r3: componente dinámico explícito, contrato de composición, E2E objetivo filtrado, runtime Ajv temporal externo, artefactos Playwright preservados y errores secundarios separados.


## 12. Incidente B06 r3 — estado normativo fuera de su esquema operativo

- Evidencia: `FinScope_local_evidence_B06_20260726-134751447_FAILED.zip` (`f1915acdf77afa759297d33fafe8ed657ecef774f6f314228ad3b712184c04cd`).
- Resultado: ocho comandos PASS; `regression-vitest` FAIL; dos comandos `NOT_RUN`.
- Causa: cinco propiedades de transporte del runner fueron agregadas a `IMPLEMENTATION_STATE.validationWorkflow`, cuyo esquema prohíbe propiedades adicionales.
- Observación: el control-plane anterior verificaba hashes, mirrors y gates, pero no ejecutaba conformidad estructural de los documentos contra los esquemas operativos.
- Prevención r4: validación estructural sin dependencias de cuatro documentos y 25 lotes en el preflight inicial/final; autopruebas; contrato explícito; metadatos del runner fuera del estado normativo.
