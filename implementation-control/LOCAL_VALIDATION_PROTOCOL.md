# Protocolo activo de validación local externa

## Principio

Cada candidato `LOCAL_VALIDATION_REQUIRED` se valida mediante **un único runner PowerShell versionado e inmutable**. El usuario ejecuta un solo comando. El runner no debe envolver otro runner, reutilizar un nombre genérico ni mantener una segunda lista de comandos.

## Identidad y aliases

La identidad normativa se resuelve por sidecar, SHA-256 real, `PACKAGE_METADATA.json` y raíz del paquete. Los sufijos físicos agregados por transporte son aceptables. Dos archivos diferentes que pretendan la misma identidad o múltiples targets con el mismo sidecar producen FAIL por ambigüedad.

## Preflight integrado

Antes de npm, el runner debe:

- autenticar runner, candidato y sidecars;
- ejecutar análisis AST del runner exacto;
- autoprobar JSON, timestamps, culturas y parser de descubrimiento;
- comprobar PowerShell Core, Node, npm, lockfile y scripts;
- leer `browserRequired` y `localValidation.commands` desde `batches/Bxx.json`;
- verificar CRC, raíz única, extracción segura, rutas Windows, symlinks, colisiones case-fold, ZIPs anidados, manifiesto, inventario y metadata;
- verificar `.specify`, `tasks.md`, gates, estado, batch, lock, mirrors y validador del plano de control sin fijar `checkCount`.

El switch opcional `-PreflightOnly` pertenece al mismo runner; no requiere un segundo script.

## Ejecución

Los comandos se ejecutan exactamente en el orden declarado, con cwd, timestamps ISO con offset, duración, exit code y stdout/stderr separados. El primer comando requerido que falle detiene los siguientes. El runner elimina códigos ANSI antes de interpretar salida humana, desactiva color cuando es posible y autoprueba parsers Vitest/Playwright antes de npm.

Un exit code 0 no basta para suites: debe demostrarse descubrimiento positivo y ausencia de tests failed, skipped, pending o todo. La prueba primaria nunca puede ser sustituida por un error posterior del parser, schema o empaquetado.

## Evidencia

PASS y FAIL funcional generan evidencia completa con:

- JSON core validado por schema;
- `VERIFICATION_SUMMARY.json` y `primaryFailure`;
- logs por comando;
- resultados de AST, cultura y parser;
- contexto exacto de ejecución;
- runner y sidecars autenticados;
- preflight integrado;
- `EVIDENCE_INVENTORY.json` y `EVIDENCE_MANIFEST.sha256`;
- ZIP final y sidecar.

Después de los comandos se eliminan dependencias, builds y caches regenerables, y el árbol estable debe volver al hash inicial. Un candidato o evidencia FAIL nunca reemplaza el último completed.
