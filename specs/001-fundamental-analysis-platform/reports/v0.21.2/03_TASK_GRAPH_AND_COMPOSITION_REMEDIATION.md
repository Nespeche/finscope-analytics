# Remediación del DAG, composición y pruebas

## Invariantes preservados

- IDs T001–T109: 109/109, sin altas ni bajas.
- Batches B01–B25: 25/25, máximo seis tareas.
- B01: `COMPLETED`; B02: `PENDING` y único autorizado.
- Gates: implementación abierta, convergencia cerrada.
- `.specify`: sin modificación.

## Cambios del DAG

- T002 depende de T001.
- T003 depende de T001/T002.
- T005 depende de T001/T002.
- T006 depende de T001/T002/T005.
- T010 depende del arnés completo B01.
- T004 depende de T003/T005/T006.
- T007 y T009 incorporan dependencias reales de toolchain/test.
- T019/T021/T095/T096/T098 incorporan runners requeridos.
- Vistas posteriores incorporan T022 cuando consumen primitives.

Los `externalDependencies` de todos los batches se recalculan desde `tasks.md`; no son editados manualmente.

## Composición

AUTH-027 evita colisiones sobre entrypoints y módulos huérfanos:

- browser: `src/main.ts` monta `App.svelte`; `app/composition.ts` descubre metadata tipada y ordenada;
- Worker: runners/pipelines registran descriptores en `operation-registry.ts`;
- gateway: las rutas solo existen si `src/index.ts` las registra en su tabla cerrada.

## Descubrimiento de pruebas

- Vitest: unit, integration, contract, negative y performance `*.test.ts`.
- Playwright: e2e, accessibility y performance `*.spec.ts`.
- Helpers sin sufijo ejecutable no cuentan como PASS.
- `passWithNoTests` no demuestra `Done when`.
- Cada lote contiene comandos exactos y un output de evidencia externo al candidato.
