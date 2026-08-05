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
4. Despachar `Apply-GitHubBatchClosure.mjs` solo para `BATCH_CLOSURE` y `Apply-GitHubRemediationClosure.mjs` solo para `REMEDIATION_CLOSURE`; el aplicador de remediación crea el commit local y no ejecuta push.
5. Para una remediación, autenticar ancestry, run, artifact, digest, manifest, ambos validadores de schema, comandos requeridos y baseline B20; comprobar B21 `COMPLETED`, B22 `PENDING` y `convergenceAuthorized=false`.
6. Ejecutar control plane y verificación local; cualquier outcome distinto de `success`, contexto faltante o cambio en tareas, `IMPLEMENTATION_STATE`, batches, producto o `.specify` bloquea la finalización.
7. Ejecutar `Finalize-GitHubRemediationClosure.mjs` solo tras PASS local. Debe exigir que HEAD local sea el closure SHA, que la rama remota siga exactamente en request SHA, demostrar que closure SHA es descendiente fast-forward de request SHA, usar un push normal sin `--force` ni `--force-with-lease`, y volver a confirmar el closure SHA remoto.
8. Generar y subir evidencia PASS únicamente después de esa confirmación remota. Permitir únicamente `GITHUB_HANDOFF.json`, `CHANGE_LEDGER.md` y los dos reportes declarados por la `closurePolicy`. No promover tareas o lotes.
9. Conservar artifacts `_FAILED`, corregir mediante commit nuevo y workflow completo nuevo; no usar `Re-run jobs`.
5. Conservar cualquier evidencia `_FAILED`; corregir con commit nuevo y ejecución completa nueva, sin `Re-run jobs`.


<!-- B21_PUSH_NORMAL_OPERATOR_POLICY_V1 -->
# Selección normativa de operador

1. ChatGPT conectado a GitHub es el operador predeterminado para autenticación de Fuentes, lectura de autoridades, auditoría de PR/runs/artifacts y verificación posterior.
2. ChatGPT solo ejecuta una mutación cuando dispone de todas las primitivas necesarias, puede construir un único commit atómico, puede comprobar el HEAD esperado inmediatamente antes de actualizar la referencia y la autorización literal incluye esa mutación.
3. VS Code es el operador predeterminado para cambios locales multarchivo, ejecución de npm, inspección de diff, commit y push normal.
4. Codex queda deshabilitado por defecto. Solo puede utilizarse cuando el usuario lo solicite explícitamente en el mensaje vigente. Ningún protocolo, prompt histórico ni recomendación automática puede activar Codex.
5. En los primeros pasos de toda operación se ejecuta un gate de capacidad. Si ChatGPT no puede garantizar atomicidad, contenido íntegro o control de concurrencia, debe detenerse con `OPERATOR_HANDOFF_REQUIRED_VSCODE`; no debe continuar razonando ni buscar mutaciones secuenciales.
6. Una ejecución en `candidate/NOT_REQUESTED` nunca intenta cerrar: devuelve `NOT_APPLICABLE`. La transición a `closure/PENDING` requiere autorización humana literal y un único commit que modifique exactamente `GITHUB_HANDOFF.json` y `CHANGE_LEDGER.md`.
7. La selección de herramienta no modifica autoridades ni gates: solo determina dónde se ejecuta la operación ya autorizada.

# Publicación como gate independiente

1. Ready for Review, merge, cierre `COMPLETED` y `release.pending=true` son condiciones separadas de la autorización de publicación. Ninguna de ellas permite ejecutar automáticamente `FinScope Completed Release`.
2. El único inicio válido es un `workflow_dispatch` manual sobre `main` con `expected_main_sha` igual al `GITHUB_SHA` exacto y con el texto canónico exacto derivado de tag, ZIP y sidecar. No se admite texto genérico, espacios extra ni una identidad aproximada.
3. Antes de cada mutación del Release se vuelve a comprobar evento, rama, checkout, SHA, operación `RELEASE_REMEDIATION/completed`, closure `COMPLETED`, `release.pending=true`, `convergenceAuthorized=false` y ausencia del tag/Release.
4. El grupo de concurrencia serializa el mismo SHA y la misma identidad canónica con `cancel-in-progress: false`. Una segunda ejecución no reutiliza ni reemplaza la publicación: debe fallar al encontrar la identidad ya existente.
5. El PR Draft #43 y su HEAD `14c7ae8e9ac918e6186b2e11147c149156309bbe` se conservan exclusivamente como evidencia técnica; no se reutilizan como cierre, no se marcan Ready y no se fusionan para formalizar esta remediación.
6. La remediación `release-publication-gate-hardening` comienza en `candidate/NOT_REQUESTED`. Su candidato técnico validado no autoriza cierre, dispatch, tag, Release, reemplazo de Fuentes, B22 ni convergencia.
7. Cualquier `FAIL` se preserva, los comandos dependientes quedan `NOT_RUN` y la corrección exige commit nuevo y ejecución completa nueva. Nunca usar `Re-run jobs`.
