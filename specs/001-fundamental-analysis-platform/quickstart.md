# Quickstart funcional futuro y oráculos

**Revisión normativa del contenido:** v0.19.3  
**Paquete/fase activa:** v0.21

Este documento describe comportamiento verificable futuro; no constituye implementación.

## Flujo 1 — primer análisis

1. Ingresar/seleccionar CIK sin ambigüedad.
2. Solicitar consentimiento de red puntual o persistente.
3. Mostrar progreso y permitir cancelar.
4. Adquirir Submissions → Company Facts → fallbacks exactos dentro de 14 llamadas.
5. Publicar resultado completo/partial con evidencia; nunca una recomendación.
6. Con `storageConsent`, persistir candidato y pointer en una transacción.

## Flujo 2 — abrir o reanudar

- Sin `refreshConsent`: cargar local, cero red.
- Fresh <6h: cero red.
- Stale 6h–<7d: Submissions primero.
- Expired ≥7d: intentar refresh y conservar snapshot previo ante error.
- Aplicación cerrada: no existe scheduler.

## Flujo 3 — actualización manual

**Actualizar fundamentales** fuerza una comprobación de novedad. No salta consentimiento, presupuesto ni fair-access.

## Flujo 4 — importar precio

Seleccionar CSV ≤5 MiB/50.000 filas/8 columnas → validar completo → preview → confirmar → nueva overlayVersion → recalcular solo precio. Duplicados o fórmulas de hoja se rechazan, nunca se corrigen silenciosamente.

## Flujo 5 — exportar/restaurar

- Exportar genera paquete JSON local versionado y hasheado.
- Restaurar presenta preview y conflicts; exige `storageConsent`.
- Todos los records se validan antes de escribir.
- Fallo en cualquier store revierte todo.
- La importación no concede consentimiento de red.

## Flujo 6 — borrar

Borrar precio conserva fundamentales. Borrar todos los datos exige confirmación, ofrece export previo y ejecuta una transacción atómica.

## Flujo 7 — perfil limitado o facts conflictivos

Métricas incompatibles: `not_applicable`. Inputs insuficientes: `insufficient`. Conflicto de igual precedencia: `ambiguous/conflicting`, sin valor inventado.

## Flujo 8 — accesibilidad

Todos los controles operan por teclado, foco visible/no obstruido, status anunciables, errores asociados y reduced motion. La autoridad es `definitions/wcag-2.2-aa-matrix.json`.

## Oráculos previos a tareas

- 84 AC y fixtures resuelven.
- 49 FR/NFR tienen cobertura forward/reverse.
- 34 autoridades resuelven.
- 15 fórmulas sin huérfanos.
- 24+8 métricas y 72+24 vectores.
- 81 estados = 35 permitidos + 46 prohibidos.
- OpenAPI 3.1.1, 11 GET y refs válidas.
- Gate exacto de `V0.21_PHASE_STATUS.md`.
