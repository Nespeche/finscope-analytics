# Errata de conteo de dominios métricos

## Hallazgo

`reports/v0.21/06_POST_TASKS_CONSISTENCY_ANALYSIS.*` registraba 0 métricas fundamentales y 32 de precio.

## Autoridad correcta

- FR-013;
- `PACKAGE_METADATA.json`;
- `definitions/metric-catalog.json`;
- `07_POST_TASKS_COVERAGE_MATRIX.json`.

Conteo correcto: 24 fundamentales + 8 de precio = 32.

## Impacto

Errata derivada, sin impacto semántico en especificación, plan, tareas, fixtures, trazabilidad, DAG o gate. Los dos archivos 06 fueron corregidos y anotados.
