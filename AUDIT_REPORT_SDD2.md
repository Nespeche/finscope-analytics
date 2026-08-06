# Auditoría profesional SDD/GitHub — FinScope Analytics

Fecha: 2026-08-06  
Baseline auditado: `FS_v0.21.25_B20_completed.zip`  
SHA-256: `c18b1390c416b5c538e1b7cf704c610754e4cff2f3eeec8c2c08bc800b120fc6`  
GitHub observado: `Nespeche/finscope-analytics`, `main@db9588c7256529b6f119f23abb1b17dbd14fa6dc`.

## Dictamen

El producto y las autoridades Spec-Driven son recuperables y coherentes en lo esencial. La fuente principal de ineficiencia no es el código de producto: es el plano de control GitHub, cuya máquina de estados quedó distribuida entre documentos, JSON, PR body, workflows, commits de cierre y evidencia externa.

El baseline B20 es un ZIP técnicamente válido: sidecar/hash, CRC, raíz única, rutas seguras, ausencia de symlinks, colisiones y ZIPs anidados, inventario/manifiesto, 19 `.specify` y validador completed PASS. Sin embargo, el verificador rechaza el alias físico `(1)` aunque la política declara que ese sufijo no altera identidad. Al renombrar a su nombre lógico, PASS. Esto demuestra una contradicción entre protocolo y ejecutable.

## Hallazgos bloqueantes

### F-01 — Estado post-merge imposible

PR #46 fue merged, pero `main` conserva:

- `closure.status=PENDING`;
- `release.pending=true`;
- hold activo;
- prohibición de merge;
- phase status que aún declara merge no autorizado.

El repositorio contiene bytes ya promovidos por merge y, simultáneamente, autoridades que describen una etapa anterior. El siguiente chat no puede derivar una transición inequívoca.

### F-02 — Estado duplicado y no transaccional

Los mismos conceptos aparecen en `V0.21_PHASE_STATUS.md`, `IMPLEMENTATION_STATE.json`, `GITHUB_HANDOFF.json`, `PACKAGE_METADATA.json`, PR body y workflows. Cada transición exige actualizar mirrors; una actualización parcial produce `POST_APPLY_SCOPE_MISMATCH`, stale holds o falsos bloqueos.

### F-03 — Cierre self-referential

El mecanismo antiguo inserta autorización en el PR, genera un commit de cierre y después intenta registrar el SHA/evidencia que solo existe tras ese commit. Esto obliga a campos pendientes, excepciones y materialización de derivados. El historial reciente necesitó 43 commits y 22 archivos para una remediación de control plane.

### F-04 — PR body usado como semáforo

Los literales de autorización en un cuerpo mutable del PR mezclan interfaz humana con autoridad ejecutable. Produjeron fallos como `B20_CLOSURE_LITERAL_DOCUMENTED` y requieren insertar/retirar texto sin cambiar el árbol Git.

### F-05 — Evidencia dentro de autoridad

Run IDs, artifact IDs, digests y estados de Actions se guardan en archivos normativos. Esos datos envejecen inmediatamente y fuerzan nuevos commits que invalidan el HEAD previamente validado. GitHub debe ser la autoridad de evidencia; el repositorio solo debe declarar la política.

### F-06 — Validador incompleto

`Validate-ControlPlaneState.mjs` del baseline devuelve 1031/1031 PASS, pero no carga `GITHUB_HANDOFF.json`. Por ello no detecta el baseline operativo B19/T088 obsoleto ni contradicciones de hold/release. Es un falso negativo de integridad, aunque no un falso PASS de producto.

### F-07 — Identidad de transporte contradictoria

La norma indica que `(1)`, `(2)` no alteran identidad; `Verify-GitHubCompletedPackage.mjs` exige igualdad del nombre físico. Resultado: `COMPLETED_ZIP_NAME_MISMATCH` para bytes válidos. SDD2 valida el nombre lógico del sidecar y el SHA real, no el alias de descarga.

### F-08 — Derivados versionados

`PACKAGE_METADATA.json`, `PACKAGE_INVENTORY.json` y `FILE_MANIFEST.sha256` generan diffs masivos, dependencias circulares y riesgo de contaminación del workspace. En SDD2 se generan dentro del ZIP de Release y no se versionan.

### F-09 — Instrucciones sin margen y roles ambiguos

Las instrucciones antiguas tienen 7.999 caracteres —formalmente dentro del límite— pero 8.108 bytes y solo un carácter de margen. Además niegan el uso de Codex mientras la configuración superior lo asigna como operador. SDD2 reduce tamaño, elimina la contradicción y distingue ChatGPT gobernador, GitHub evidencia y VS Code/Codex fallback.

### F-10 — Clasificación insuficiente de fallos

El modelo anterior trata por igual un defecto determinista y una caída de infraestructura. SDD2 usa `PASS`, `FAIL`, `ENVIRONMENT_BLOCKED` y `HUMAN_REQUIRED`; solo `ENVIRONMENT_BLOCKED` permite repetir el mismo SHA.

## Causa raíz

La gobernanza intentó convertir cada transición administrativa en contenido versionado. Eso creó una máquina de estados distribuida, self-referential y sensible al orden. Cuantos más gates se agregaron para impedir errores, más mirrors y commits fueron necesarios, aumentando la superficie de contradicción.

## Diseño SDD2

1. Autoridad normativa permanece intacta: constitución, spec, crosswalk, tasks y gates.
2. `IMPLEMENTATION_STATE.json` describe una sola frontera de avance.
3. `OPERATION.json` declara una sola operación, base SHA, rama, allowlist, comandos y promoción; no contiene estado de ciclo.
4. `BASELINE_LOCK.json` fija el paquete completed usado como entrada y la base GitHub esperada; no intenta autoidentificar el ZIP que lo contiene.
5. No hay `GITHUB_HANDOFF.json`, commit de cierre ni literal en PR.
6. Un HEAD candidato recibe validación exact-head; el owner lo mergea explícitamente.
7. Release manual separado y ligado al merge SHA.
8. Assets publicados se descargan y reautentican antes de Fuentes.
9. Run/artifact IDs no se guardan en autoridad.
10. Derivados del paquete se generan al publicar.
11. El validador y el empaquetador leen dinámicamente operation/state/baseline: no hardcodean B20, B21 ni nombres de ZIP.
12. La validación de scope se repite antes del Release y el paquete se crea desde `git ls-files` con árbol tracked limpio.

## Impacto esperado

- Menos commits administrativos y menos diffs de derivados.
- Eliminación de `POST_APPLY_SCOPE_MISMATCH` causado por cierre/materialización.
- Eliminación de autorizaciones por texto mutable del PR.
- Reanudación determinista desde un chat nuevo.
- Separación clara entre FAIL del producto, bloqueo de infraestructura y control humano.
- B21–B25 pueden ejecutarse con el mismo protocolo ordinario, sin una variante especial por lote.

## Límites de esta entrega

No se modificó GitHub. El ZIP SDD2 es un candidato de migración y no un completed. La segunda revisión corrigió además un validador inicialmente específico de la migración, un empaquetador inicialmente hardcodeado a B20/T089 y una clasificación incompleta del E404 del proxy interno. `npm ci`, typecheck, suites y build siguen siendo obligatorios en el HEAD exacto mediante GitHub Actions o VS Code antes del merge.
