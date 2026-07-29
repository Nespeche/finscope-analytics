# Handoff de sesión de implementación

## Identidad y cadena de custodia

- Baseline lógico completado de entrada:
- SHA-256 del baseline y sidecar verificado:
- Candidato lógico actual, si existe:
- SHA-256 del candidato y sidecar verificado:
- Hash canónico `.specify` antes/después:
- SHA-256 de `tasks.md` y lock verificado:

## Gates y estado efectivo

- Phase status activo:
- `tasksAuthorized`:
- `analysisAuthorized`:
- `implementationAuthorized`:
- `convergenceAuthorized`:
- Lote ejecutado / `activeBatchId`:
- Estado del lote:
- Tareas `COMPLETED`:
- Tareas `IMPLEMENTED_PENDING_VALIDATION`:
- Tareas `BLOCKED`:
- Próximo lote autorizado:

## Alcance y autoridades

- Autoridades primarias leídas:
- Archivos creados/modificados/eliminados:
- Cambios de comportamiento normativo: sí/no; autoridad actualizada:
- Deprecaciones o código aparentemente no usado revisado:

## Validación y evidencia

- Comandos requeridos:
- Comandos ejecutados, exit code y resultado:
- Tests descubiertos / skipped / omitted:
- Bundle de evidencia, SHA-256 y schema:
- Resultado: `PASS`, `FAIL` o `NOT_RUN`:
- Limitaciones del entorno sin inferir PASS:

## Continuidad

- Hallazgos abiertos con severidad y condición de cierre:
- Decisiones diferidas y lote recomendado:
- Próxima operación exacta permitida:
- Acciones expresamente prohibidas:
- Tipo de paquete de salida: baseline completado o candidato:
- Confirmación: `convergenceAuthorized=false`.

No depender del chat anterior. Un candidato `LOCAL_VALIDATION_REQUIRED` se adjunta al chat y no se sube a Fuentes del Proyecto. La promoción exige candidato, sidecar y bundle de evidencia correspondiente al mismo árbol.
