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
4. En la rama exacta de hardening exigir `mode=CONTROL_PLANE_REMEDIATION` y ejecutar solo sus comandos dedicados.
5. Conservar cualquier evidencia `_FAILED`; corregir con commit nuevo y ejecución completa nueva, sin `Re-run jobs`.
