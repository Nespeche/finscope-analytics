# GitHub Operator Step-by-Step Protocol

**Ruta normativa:** `implementation-control/GITHUB_OPERATOR_STEP_BY_STEP_PROTOCOL.md`  
**Estado:** protocolo de método y comunicación operativa para GitHub-first  
**No sustituye:** Constitución, `spec.md`, `tasks.md`, batches, schemas, gates ni `IMPLEMENTATION_STATE.json`.

## 1. Objetivo

Toda interacción operativa de FinScope Analytics con GitHub debe ser ejecutable y verificable por una persona sin experiencia avanzada en Git, GitHub Actions, PowerShell o VS Code.

## 2. Contenido obligatorio de cada respuesta operativa

Cada avance, validación, cierre, promoción, Release o recuperación de error debe indicar:

1. estado actual de lote, rama, Pull Request, commit, workflow y gate;
2. objetivo exacto del paso;
3. ruta absoluta corta de Windows desde la que se trabaja;
4. menús y botones exactos de GitHub cuando correspondan;
5. comandos completos para PowerShell en la terminal integrada de VS Code;
6. si los comandos se ejecutan uno por uno o como bloque;
7. resultado esperado de cada comando;
8. condición de detención ante `FAIL`;
9. archivos requeridos antes de continuar;
10. archivos a descargar, adjuntar o devolver;
11. archivos o carpetas a retirar para evitar mezclar revisiones;
12. acciones prohibidas;
13. siguiente mensaje exacto que debe enviar el usuario.

## 3. Reglas para comandos

Los comandos deben declarar PowerShell, `cwd`, compatibilidad con VS Code y rutas cortas cuando reduzcan errores. Antes de mutar se comprueban `git`, `node`, `npm`, `pwsh` y `gh` cuando sean necesarios, además de `git status --short`, rama, remoto, commit y tag. Los comandos se derivan de autoridades activas; no se inventan. Se prohíben comodines destructivos, borrados ambiguos, `git add -A` sobre un árbol mezclado y continuar después de un resultado no esperado.

## 4. Reglas para GitHub

Toda operación debe identificar `Nespeche/finscope-analytics`, rama base, rama de trabajo, PR, workflow run, job, check y artifact. El merge solo se autoriza con los checks exigidos en `PASS`. El tag y el Release se crean únicamente después del cierre aprobado. Los assets normativos son ZIP completed y sidecar personalizados; `Source code (zip)` y `Source code (tar.gz)` nunca son el baseline.

## 5. Continuidad

Cada handoff debe contener repositorio, rama, SHA completo, PR, runs, checks, lote, tareas, baseline anterior, candidato/completed, SHA-256, tag/Release, próximo paso y `convergenceAuthorized=false`. `implementation-control/GITHUB_HANDOFF.json` y `implementation-control/IMPLEMENTATION_STATE.json` son las fuentes principales. La memoria conversacional nunca es autoridad suficiente.

## 6. Fuentes del Proyecto

Fuentes conserva solo la pareja completed activa: ZIP y sidecar. No se agregan protocolos sueltos, prompts, candidatos, runners, artifacts temporales, evidencias FAIL, clones ni extracciones.

## 7. Cumplimiento

Una respuesta general sin rutas, comandos, resultados esperados, condición de detención y siguiente paso concreto es incompleta.
# Transición automática B20 → B21

1. Resolver el contexto con `node implementation-control/scripts/Resolve-GitHubContext.mjs "$GITHUB_HEAD_REF"` antes de instalar dependencias.
2. Verificar que una rama ordinaria devuelve `mode=BATCH`, `batchId=B21`, `batchAuthoritySource=IMPLEMENTATION_STATE` y `baselineRole=CURRENT_COMPLETED_BASELINE`.
3. Autenticar el Release indicado por el contexto resuelto, nunca `handoff.baseline` como fallback implícito.
4. Para una rama presente en `GITHUB_HANDOFF.remediations`, exigir coincidencia exacta, modo reconocido, baseline completed vigente, allowlist de rutas íntegra y comandos literales dedicados.
5. Para mantenimiento no normativo exigir `mode=MAINTENANCE_REMEDIATION`; no ejecutar comandos funcionales de B21 ni alterar `.specify`, tareas, lotes o gates.
6. Verificar el diff contra `allowedPaths` antes de `npm ci`; cualquier ruta adicional debe producir `MAINTENANCE_SCOPE_MISMATCH` y dejar los comandos posteriores `NOT_RUN`.

# Remediación de paquete completed contaminado

1. Escribir cualquier resultado de `Resolve-GitHubContext.mjs` bajo `$RUNNER_TEMP/finscope-context`, conservar su ruta en una variable y limpiarlo con `if: always()`.
2. Exigir worktree limpio y extraer el commit exacto desde objetos Git; nunca copiar el workspace físico.
3. Aplicar denylist antes de inventory, antes de manifest y dentro del verificador.
4. Verificar paths y bytes ordinarios contra Git y permitir diferencias solo para outputs generados cerrados.
5. Tras publicar, reautenticar los cinco assets y subir evidencia post-publicación; ante fallo preservar el Release publicado y el artifact `_FAILED`.
6. Una revisión completed posterior debe usar identidad inmutable nueva y autorización humana independiente.

# Cierre de una remediación declarada

1. Resolver `node implementation-control/scripts/Resolve-GitHubContext.mjs "$GITHUB_HEAD_REF" --closure` hacia `$RUNNER_TEMP/finscope-context`.
2. En `candidate/NOT_REQUESTED`, registrar `NOT_APPLICABLE` y detener el cierre sin invocar ningún aplicador.
3. Una futura solicitud humana debe cambiar únicamente las rutas de `closurePolicy.requestAllowedPaths`, declarar `closure/PENDING` y cargar el candidato propio exacto.
4. Despachar `Apply-GitHubBatchClosure.mjs` solo para `BATCH_CLOSURE` y `Apply-GitHubRemediationClosure.mjs` solo para `REMEDIATION_CLOSURE`.
5. Para una remediación, autenticar ancestry, run, artifact, digest, manifest, ambos validadores de schema, comandos requeridos y baseline B20; comprobar B21 `COMPLETED`, B22 `PENDING` y `convergenceAuthorized=false`.
6. Permitir únicamente `GITHUB_HANDOFF.json`, `CHANGE_LEDGER.md` y los dos reportes declarados por la `closurePolicy`. No promover tareas o lotes.
7. Conservar artifacts `_FAILED`, corregir mediante commit nuevo y workflow completo nuevo; no usar `Re-run jobs`.
5. Conservar cualquier evidencia `_FAILED`; corregir con commit nuevo y ejecución completa nueva, sin `Re-run jobs`.
