# Nota de vigencia

Este informe se conserva como evidencia histórica de v0.6. El estado vigente está en `PROJECT_CONTEXT.md` y `specs/001-fundamental-analysis-platform/reports/`.

# Auditoría y reorientación del baseline

## 1. Baseline auditado

- Archivo: `FinScope_Analytics_SpecDev_ChatGPT_v0.5_clarification(1).zip`.
- SHA-256: `1723e18f8d379f1b47f451c4a8caa2f9fe7a95bbea9597b527ae94ea05d89b2a`.
- Integridad ZIP: aprobada; no se detectaron errores de compresión.
- Archivos: 32.
- Código de producto: inexistente.
- Infraestructura Spec Kit: presente y consistente con integración `generic` 0.13.0.
- Fases contenidas: contexto, constitución, especificación y aclaración.
- `plan.md`, `research.md`, `data-model.md`, `contracts/` y `quickstart.md`: no existían.

## 2. Hallazgos bloqueantes

1. La constitución 1.0.0 prohibía depender de cotizaciones operativas y exigía que toda vista pública estuviera precalculada.
2. La especificación limitaba el catálogo a exactamente quince compañías no financieras.
3. Bancos y aseguradoras estaban excluidos incluso del catálogo, en lugar de separar descubrimiento de aplicabilidad de KPI.
4. Alpha Vantage tenía presupuesto obligatorio de cero solicitudes, por lo que el precio no podía ser parte del flujo.
5. El modelo priorizaba ingestión por lotes y almacenamiento normalizado central, contrario al nuevo objetivo de análisis solicitado.
6. El resumen, los KPI y las señales no incluían estadísticas de precios ni valuación contextual.
7. Existían discontinuidades menores de numeración (`AC-US02-05` y `FR-FIN-015` ausentes), corregidas mediante una nueva especificación coherente.
8. Los presupuestos internos y referencias de plataforma debían volver a verificarse durante el plan.

## 3. Elementos preservados

- Fidelidad contable y no invención.
- Trazabilidad de SEC y XBRL.
- Distinción entre períodos y estados de datos.
- Reglas determinísticas de KPI e insights.
- Seguridad, accesibilidad y publicación controlada.
- React, Vite, TypeScript, Cloudflare Pages, Workers/Functions, D1 y GitHub.
- Infraestructura interna `.specify` y todos los prompts de fase.

## 4. Reorientación aprobada por el usuario

- No se necesita tiempo real.
- Se requiere último cierre y estadísticas de mínimos, máximos y promedio.
- Solo se utilizarán herramientas gratuitas.
- Los datos se obtendrán cuando el usuario solicite un análisis.
- La normalización y los cálculos se realizarán principalmente en el navegador.
- El backend conservará catálogo, definiciones y resultados mínimos, no todo el universo crudo.
- El análisis se dividirá en botones progresivos: cotización, fundamentales, valuación e integral.

## 5. Cambio de arquitectura

### Antes

`ingestión programada -> normalización central -> D1 completo -> API pública precalculada`

### Después

`acción explícita -> gateway liviano -> datos temporales -> Web Worker -> análisis local -> persistencia opcional mínima`

## 6. Enmienda constitucional

La modificación es incompatible con 1.0.0, por lo que se incrementó la constitución a 2.0.0. Se permiten solicitudes externas explícitas, BYO API key, CSV, análisis de mercado, valuación y persistencia local, manteniendo no redistribución, costo cero y ausencia de recomendaciones personalizadas.

## 7. Resultado de la fase

Se generaron o actualizaron:

- `PROJECT_CONTEXT.md`.
- `.specify/memory/constitution.md` 2.0.0.
- `specs/001-fundamental-analysis-platform/spec.md`.
- `specs/001-fundamental-analysis-platform/plan.md`.
- `specs/001-fundamental-analysis-platform/research.md`.
- `specs/001-fundamental-analysis-platform/data-model.md`.
- `specs/001-fundamental-analysis-platform/quickstart.md`.
- `specs/001-fundamental-analysis-platform/contracts/`.

No se generaron código, migraciones, dependencias ni `tasks.md`. El próximo paso permitido es la fase de checklist.
