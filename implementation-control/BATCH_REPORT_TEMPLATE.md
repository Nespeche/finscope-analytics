# Bxx — Informe de implementación

## Identidad
- Baseline de entrada completado:
- SHA-256 verificado:
- Lote:
- Tareas:
- SHA-256 de `tasks.md`:

## Precondiciones
- Integridad/CRC/extracción segura:
- Gate y único lote autorizado:
- Dependencias de tareas:
- `TASK_SOURCE_LOCK`:
- `.specify` antes:

## Cambios
| Tarea | Estado | Archivos | Composición alcanzable | Done when |
|---|---|---|---|---|

Estados válidos: `COMPLETED`, `IMPLEMENTED_PENDING_VALIDATION`, `BLOCKED`.

## Pruebas
| Comando exacto de `localValidation` | Entorno | Exit code | Evidencia |
|---|---|---:|---|

## Resultado del lote
- Estado: `COMPLETED`, `LOCAL_VALIDATION_REQUIRED`, `PARTIAL` o `BLOCKED`.
- Evidencia local incorporada:
- Hallazgos bloqueantes/residuales:

## Empaquetado
- Tipo: baseline completado o candidato de validación.
- ZIP:
- Sidecar:
- Inventario/manifiesto:
- `.specify` después:
- Próximo lote:

Solo un lote `COMPLETED` con todas las pruebas obligatorias en PASS puede promoverse a baseline y reemplazar Fuentes del Proyecto.
