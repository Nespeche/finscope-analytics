> **HISTORICAL EVIDENCE — v0.19.** Sus hallazgos motivaron v0.19.1. No es autoridad de gate ni prueba de cierre; el nuevo baseline requiere checklist independiente.

# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Registro de bloqueantes para avanzar a tareas

**Estado**: `NO APROBADO PARA TAREAS`  
**Fecha**: 2026-07-20

La fase `tareas` no debe comenzar mientras los siguientes bloqueantes no sean resueltos mediante una corrección documental controlada de especificación/plan/contratos y una nueva ejecución de checklist.

## H-B01 — Licencias de proveedores personales

- **Documento afectado**: spec.md §CR-LIC; research.md Decisions 1/7; provider-adapter.md §§2/7/8
- **Problema**: No existe una matriz de aplicabilidad que resuelva si el proxy BYO-key de una app pública, el display al mismo usuario y la retención local cumplen los términos vigentes de Twelve Data y Alpha Vantage.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Decidir por proveedor y modalidad: habilitado, deshabilitado o condicionado; documentar display, uso comercial/personal, retención y revisión. Revisión legal independiente cuando corresponda.

## H-B02 — Catálogo normativo de KPI, estadísticas y valuación ausente

- **Documento afectado**: spec.md §§FR-MKT/FR-KPI/FR-VAL; data-model.md §3.12; analysis-pipeline.md §§6–8
- **Problema**: Se enumeran métricas, pero faltan fórmulas completas, componentes, períodos, unidades, redondeo, muestra mínima, valores negativos/nulos, tolerancias y textos para múltiples KPI y múltiplos.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Agregar un catálogo normativo versionado de MetricDefinition y PriceStatisticDefinition con fórmula, inputs, aplicabilidad, estados y tolerancias.

## H-B03 — Reglas de insights y confianza incompletas

- **Documento afectado**: spec.md §FR-INS; data-model.md §§3.15–3.16; analysis-pipeline.md §9
- **Problema**: No están definidos umbrales, precedencia, desempate, cobertura suficiente, algoritmo de confianza ni reglas de conclusión fuerte/insuficiente.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Agregar catálogo inicial versionado de reglas y un modelo explícito de confianza, con fixtures y salidas insuficientes.

## H-B04 — Cobertura y estados contradictorios

- **Documento afectado**: constitution.md §VII; spec.md §§FR-CAT-005/FR-DQ-002; data-model.md §3.2; openapi.yaml
- **Problema**: OpenAPI omite cobertura de insights y usa estados genéricos incompatibles con marketCoverage/identidad del modelo.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Definir dimensiones y vocabularios canónicos; alinear spec, modelo, OpenAPI, almacenamiento y UI.

## H-B05 — Búsqueda externa sin contrato ejecutable

- **Documento afectado**: spec.md §FR-CAT-007; provider-adapter.md §§2–4; openapi.yaml
- **Problema**: supportsSymbolSearch existe, pero la interfaz no ofrece método y OpenAPI no define gateway/flujo de búsqueda externa.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Agregar contrato de búsqueda personal o retirar explícitamente esa capacidad del MVP.

## H-B06 — Transporte de credenciales contradictorio

- **Documento afectado**: spec.md §FR-SRC-002; plan.md §AD-001; research.md Decision 8; provider-adapter.md §3; openapi.yaml
- **Problema**: La spec permite body o header protegido; research, adaptador y OpenAPI prescriben body-only y rechazan headers reenviables.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Adoptar una única regla canónica; recomendación: credencial write-only en body HTTPS de POST, nunca query/header logueable.

## H-B07 — Contrato de entrada manual contradictorio

- **Documento afectado**: spec.md §FR-IMP-005; data-model.md §3.7; provider-adapter.md §10
- **Problema**: La spec exige mínimo/máximo/promedio; modelo y adaptador los declaran opcionales.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Definir el mínimo obligatorio, invariantes y exactamente qué resultados habilita cada combinación.

## H-B08 — OpenAPI y modelo de datos no alineados

- **Documento afectado**: data-model.md §§3.5–3.6/3.12/3.15; openapi.yaml
- **Problema**: OpenAPI admite precios negativos, moneda opcional, precision opcional y limitationsTemplate opcional donde el modelo prescribe restricciones/obligatoriedad.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Elegir el contrato canónico y alinear schemas, invariantes y ejemplos.

## H-B09 — Identidad de mercado y catálogo insuficientemente resuelta

- **Documento afectado**: spec.md §§FR-CAT/FR-VAL-005; research.md Decision 6; data-model.md §§3.1–3.3
- **Problema**: SEC por sí solo no garantiza mercado, MIC, moneda, tipo, clases, ADR ratio o historia de tickers; no se define fuente complementaria ni degradación completa.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Documentar fuentes autorizadas, precedencia, estados desconocidos y reglas para múltiples listings/clases/ADR.

## H-B10 — Acciones corporativas y ajuste de precios sin política normativa

- **Documento afectado**: spec.md §§FR-MKT-011/FR-VAL-005; provider-adapter.md; analysis-pipeline.md §§6/8
- **Problema**: No se define fuente/política completa para splits, dividendos, adjustedClose, shares y ADR; algunas capacidades ajustadas pueden no estar disponibles en free tier.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Delimitar soporte MVP por proveedor y métrica; bloquear de forma explícita cuando el ajuste sea desconocido.

## H-B11 — Alineación temporal y frescura sin umbrales

- **Documento afectado**: spec.md §§FR-DQ-004/FR-VAL-007; browser-storage.md §5; analysis-pipeline.md §8
- **Problema**: Faltan calendarios, zonas, umbrales stale, tolerancia entre precio y filing, fecha de shares y reglas TTM para comparabilidad.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Definir umbrales por dominio y mercado, con estados y casos de prueba.

## H-B12 — Criterios de aceptación no medibles

- **Documento afectado**: spec.md §§SC-011–017/SC-027; quickstart.md; research.md Decision 12
- **Problema**: Se alude a tolerancia definida y dispositivo acordado, pero no se fijan tolerancias, hardware, navegador, percentil ni metodología de medición.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Fijar oráculos numéricos, tolerancias y perfil de rendimiento reproducible.

## H-B13 — Normalización XBRL y perfiles sectoriales incompletos

- **Documento afectado**: spec.md §§FR-FIN/FR-KPI; analysis-pipeline.md §7
- **Problema**: No existe catálogo inicial de conceptos/aliases, signos, escalas, derivación trimestral ni matriz de bancos/seguros/REITs suficiente para implementar sin inventar.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Agregar contratos normativos de mapeo XBRL y aplicabilidad sectorial, incluyendo salida no aplicable.

## H-B14 — Decisiones de dependencias abiertas

- **Documento afectado**: plan.md §Technical Context
- **Problema**: “Hono o equivalente” y biblioteca gráfica condicionada dejan decisiones de arquitectura/dependencias a la fase de tareas.
- **Severidad**: Bloqueante
- **Decisión requerida/recomendación**: Cerrar la elección o definir explícitamente una solución sin dependencia y criterios ya resueltos.

## Condición de desbloqueo

1. Cada bloqueante debe quedar resuelto en el documento fuente correspondiente, no solamente marcado como aceptado en este registro.
2. Las referencias cruzadas entre `spec.md`, `plan.md`, `research.md`, `data-model.md`, contratos y `quickstart.md` deben quedar consistentes.
3. OpenAPI debe continuar siendo válido y reflejar el modelo canónico acordado.
4. Debe repetirse la fase checklist sobre el ZIP corregido.
5. Solo un dictamen `APROBADO PARA TAREAS` o `APROBADO CON OBSERVACIONES NO BLOQUEANTES` habilita la fase `tareas`.
