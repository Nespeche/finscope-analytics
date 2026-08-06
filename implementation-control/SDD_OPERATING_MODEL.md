# FinScope SDD2 — Operating Model

## Objetivo

Reducir la gobernanza a declaraciones verificables y transacciones GitHub exact-head, separando producto, estado operativo, identidad de paquetes y evidencia.

## Autoridades operativas

- `V0.21_PHASE_STATUS.md`: gates.
- `IMPLEMENTATION_STATE.json`: frontera completed, batch activo y bloqueos.
- `OPERATION.json`: declaración inmutable de una transición.
- `BASELINE_LOCK.json`: paquete completed usado como entrada y base GitHub esperada.
- GitHub: ciclo de la operación, checks, artifacts, merge y Release.
- ZIP + sidecar + metadata: identidad del paquete.

No existe `GITHUB_HANDOFF.json`, no hay commit de cierre y el PR body no es semáforo.

## Ciclo

GitHub registra `validated → merged → released`. Esos estados no se escriben en `OPERATION.json`. Tras reautenticar el Release, una operación nueva reemplaza la declaración anterior y actualiza su baseline de entrada.

## Separación

Normativo: constitución, spec, crosswalk, tasks y gates.
Operativo: implementation state, operation declaration y baseline input lock.
Derivado: package metadata, inventory, manifest y reportes.
Evidencia: checks, artifacts y Releases de GitHub o bundles externos.

Los derivados no se versionan. La evidencia no modifica autoridad por sí sola.
