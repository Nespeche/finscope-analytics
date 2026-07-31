# Política del repositorio GitHub

## Repositorio y ramas

- Repositorio autorizado: `Nespeche/finscope-analytics`.
- Rama protegida de integración: `main`.
- Todo cambio se realiza en la rama temática declarada por `GITHUB_HANDOFF.json` y en Pull Request Draft; nunca se trabaja directamente sobre `main`.
- Cada operación parte del commit completed autenticado declarado como baseline y conserva una única rama de trabajo hasta cierre o abandono explícito.

## Autoridad

GitHub conserva código, protocolos y evidencia ejecutable, pero no reemplaza las autoridades de producto. `IMPLEMENTATION_STATE.json` gobierna continuidad; `tasks.md` define tareas; `batches/Bxx.json` es mirror bloqueado; runs/artifacts son evidencia; Release completed + ZIP/sidecar es distribución portátil.

## Seguridad y costes

Los workflows usan actions oficiales fijadas a SHA completo, permisos mínimos, `GITHUB_TOKEN`, runners hospedados estándar y ningún servicio pago, trial, crédito o fallback facturable. Se prohíben secretos de producto y ejecución de código no confiable con permisos de escritura.

## Pull Requests

El PR debe conservar lotes futuros sin cambios fuera del lote autorizado. Los checks estables son:

- `FinScope PR Validation / validate`;
- `FinScope Closure Validation / verify-closure`.

Un artifact `PASS` o `_FAILED` se genera siempre. Un `FAIL` detiene merge y Release.

## Cierre y Release

Después del run candidato PASS solo se permite la allowlist de cierre. El Release se genera desde `main`, en staging limpio, con raíz única, CRC, manifiesto, inventario, metadata, `.specify` byte-idéntico y sidecar. Los ZIP automáticos de GitHub no son normativos.
