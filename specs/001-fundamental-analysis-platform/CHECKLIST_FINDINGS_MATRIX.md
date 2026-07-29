> **HISTORICAL EVIDENCE — v0.19.** Sus hallazgos motivaron v0.19.1. No es autoridad de gate ni prueba de cierre; el nuevo baseline requiere checklist independiente.

# Nota de vigencia

Este documento pertenece a la ejecución histórica del checklist v0.7. Sus casillas y hallazgos no fueron convertidos en aprobaciones. Para el estado normativo v0.8 consulte `reports/REMEDIATION_FINDINGS_MATRIX.md` y repita formalmente checklist.

# Matriz resumida de hallazgos — Fase checklist

**Fecha**: 2026-07-20  
**Feature**: `001-fundamental-analysis-platform`  
**Estado**: `NO APROBADO PARA TAREAS`

| ID | Severidad | Dominio | Documento/sección | Problema | Decisión requerida |
|---|---|---|---|---|---|
| `H-B01` | **Bloqueante** | Licencias de proveedores personales | spec.md §CR-LIC; research.md Decisions 1/7; provider-adapter.md §§2/7/8 | No existe una matriz de aplicabilidad que resuelva si el proxy BYO-key de una app pública, el display al mismo usuario y la retención local cumplen los términos vigentes de Twelve Data y Alpha Vantage. | Decidir por proveedor y modalidad: habilitado, deshabilitado o condicionado; documentar display, uso comercial/personal, retención y revisión. Revisión legal independiente cuando corresponda. |
| `H-B02` | **Bloqueante** | Catálogo normativo de KPI, estadísticas y valuación ausente | spec.md §§FR-MKT/FR-KPI/FR-VAL; data-model.md §3.12; analysis-pipeline.md §§6–8 | Se enumeran métricas, pero faltan fórmulas completas, componentes, períodos, unidades, redondeo, muestra mínima, valores negativos/nulos, tolerancias y textos para múltiples KPI y múltiplos. | Agregar un catálogo normativo versionado de MetricDefinition y PriceStatisticDefinition con fórmula, inputs, aplicabilidad, estados y tolerancias. |
| `H-B03` | **Bloqueante** | Reglas de insights y confianza incompletas | spec.md §FR-INS; data-model.md §§3.15–3.16; analysis-pipeline.md §9 | No están definidos umbrales, precedencia, desempate, cobertura suficiente, algoritmo de confianza ni reglas de conclusión fuerte/insuficiente. | Agregar catálogo inicial versionado de reglas y un modelo explícito de confianza, con fixtures y salidas insuficientes. |
| `H-B04` | **Bloqueante** | Cobertura y estados contradictorios | constitution.md §VII; spec.md §§FR-CAT-005/FR-DQ-002; data-model.md §3.2; openapi.yaml | OpenAPI omite cobertura de insights y usa estados genéricos incompatibles con marketCoverage/identidad del modelo. | Definir dimensiones y vocabularios canónicos; alinear spec, modelo, OpenAPI, almacenamiento y UI. |
| `H-B05` | **Bloqueante** | Búsqueda externa sin contrato ejecutable | spec.md §FR-CAT-007; provider-adapter.md §§2–4; openapi.yaml | supportsSymbolSearch existe, pero la interfaz no ofrece método y OpenAPI no define gateway/flujo de búsqueda externa. | Agregar contrato de búsqueda personal o retirar explícitamente esa capacidad del MVP. |
| `H-B06` | **Bloqueante** | Transporte de credenciales contradictorio | spec.md §FR-SRC-002; plan.md §AD-001; research.md Decision 8; provider-adapter.md §3; openapi.yaml | La spec permite body o header protegido; research, adaptador y OpenAPI prescriben body-only y rechazan headers reenviables. | Adoptar una única regla canónica; recomendación: credencial write-only en body HTTPS de POST, nunca query/header logueable. |
| `H-B07` | **Bloqueante** | Contrato de entrada manual contradictorio | spec.md §FR-IMP-005; data-model.md §3.7; provider-adapter.md §10 | La spec exige mínimo/máximo/promedio; modelo y adaptador los declaran opcionales. | Definir el mínimo obligatorio, invariantes y exactamente qué resultados habilita cada combinación. |
| `H-B08` | **Bloqueante** | OpenAPI y modelo de datos no alineados | data-model.md §§3.5–3.6/3.12/3.15; openapi.yaml | OpenAPI admite precios negativos, moneda opcional, precision opcional y limitationsTemplate opcional donde el modelo prescribe restricciones/obligatoriedad. | Elegir el contrato canónico y alinear schemas, invariantes y ejemplos. |
| `H-B09` | **Bloqueante** | Identidad de mercado y catálogo insuficientemente resuelta | spec.md §§FR-CAT/FR-VAL-005; research.md Decision 6; data-model.md §§3.1–3.3 | SEC por sí solo no garantiza mercado, MIC, moneda, tipo, clases, ADR ratio o historia de tickers; no se define fuente complementaria ni degradación completa. | Documentar fuentes autorizadas, precedencia, estados desconocidos y reglas para múltiples listings/clases/ADR. |
| `H-B10` | **Bloqueante** | Acciones corporativas y ajuste de precios sin política normativa | spec.md §§FR-MKT-011/FR-VAL-005; provider-adapter.md; analysis-pipeline.md §§6/8 | No se define fuente/política completa para splits, dividendos, adjustedClose, shares y ADR; algunas capacidades ajustadas pueden no estar disponibles en free tier. | Delimitar soporte MVP por proveedor y métrica; bloquear de forma explícita cuando el ajuste sea desconocido. |
| `H-B11` | **Bloqueante** | Alineación temporal y frescura sin umbrales | spec.md §§FR-DQ-004/FR-VAL-007; browser-storage.md §5; analysis-pipeline.md §8 | Faltan calendarios, zonas, umbrales stale, tolerancia entre precio y filing, fecha de shares y reglas TTM para comparabilidad. | Definir umbrales por dominio y mercado, con estados y casos de prueba. |
| `H-B12` | **Bloqueante** | Criterios de aceptación no medibles | spec.md §§SC-011–017/SC-027; quickstart.md; research.md Decision 12 | Se alude a tolerancia definida y dispositivo acordado, pero no se fijan tolerancias, hardware, navegador, percentil ni metodología de medición. | Fijar oráculos numéricos, tolerancias y perfil de rendimiento reproducible. |
| `H-B13` | **Bloqueante** | Normalización XBRL y perfiles sectoriales incompletos | spec.md §§FR-FIN/FR-KPI; analysis-pipeline.md §7 | No existe catálogo inicial de conceptos/aliases, signos, escalas, derivación trimestral ni matriz de bancos/seguros/REITs suficiente para implementar sin inventar. | Agregar contratos normativos de mapeo XBRL y aplicabilidad sectorial, incluyendo salida no aplicable. |
| `H-B14` | **Bloqueante** | Decisiones de dependencias abiertas | plan.md §Technical Context | “Hono o equivalente” y biblioteca gráfica condicionada dejan decisiones de arquitectura/dependencias a la fase de tareas. | Cerrar la elección o definir explícitamente una solución sin dependencia y criterios ya resueltos. |
| `H-I01` | **Importante** | Gobierno de límites y políticas de terceros | spec.md §§CR-LIC/CR-SUS; SourcePolicy; research.md Decision 13 | Falta periodicidad obligatoria de revisión, vencimiento de política y procedimiento de kill-switch/rollback ante cambios de terms o free tier. | Definir reviewedAt/expiresAt, responsable, evidencia y disabled-by-default al vencer. |
| `H-I02` | **Importante** | Presupuestos por flujo incompletos | constitution.md §IV; plan.md; research.md Decision 13 | Los topes globales son conservadores, pero no se asignan requests, CPU, memoria, D1 y caché por operación ni se define medición. | Agregar tabla de presupuesto por búsqueda, serie, SEC, publicación y sesión. |
| `H-I03` | **Importante** | Validación CSV incompleta | spec.md §§FR-IMP/CR-SEC; provider-adapter.md §9 | Faltan reglas normativas para encoding, CSV activo/formula injection, columnas/filas patológicas, atomicidad y política de filas inválidas. | Ampliar contrato de importación y casos negativos. |
| `H-I04` | **Importante** | Payloads SEC sin límites operativos | openapi.yaml SEC paths; plan.md §AD-002 | No se definen tamaño máximo, compresión, timeout, paginación/streaming o rechazo seguro para respuestas grandes. | Definir límites y estrategia coherente con Worker free y Web Worker. |
| `H-I05` | **Importante** | Detalles de trazabilidad y cálculo parciales | spec.md §FR-MKT-010; analysis-pipeline.md §6 | Algunas salidas no fijan redondeo, fechas pico-valle, ventana efectiva, factor de anualización o presentación de rango cero. | Completar metadatos normativos por estadística. |
| `H-I06` | **Importante** | Frescura, caché y estados de error parcialmente inconsistentes | spec.md §§FR-DQ/Edge Cases; browser-storage.md §5; provider-adapter.md §6 | La recuperación y habilitación de capas con datos parciales/truncados/stale no está completamente especificada. | Crear matriz estado→UI→capacidad→recuperación. |
| `H-I07` | **Importante** | Semántica de ventanas de mercado incompleta | provider-adapter.md §3; openapi.yaml MarketSeriesRequest | Las combinaciones startDate/endDate/outputSize y fechas unilaterales no tienen semántica única. | Definir exclusiones, precedencia y límites por proveedor. |
| `H-I08` | **Importante** | Cancelación y progreso incompletos | spec.md §FR-SRC-009; analysis-pipeline.md §§3–4/12 | No se define completamente la propagación UI→fetch→Worker, limpieza de credencial y estados terminales. | Agregar contrato de cancelación idempotente y progreso accesible. |
| `H-I09` | **Importante** | Decisión de visualización y nomenclatura | plan.md §Technical Context; spec.md User Stories | La dependencia gráfica y algunos nombres de acciones no están cerrados. | Definir solución y glosario UI antes de tareas. |
| `H-I10` | **Importante** | Consentimiento, retención y eliminación local incompletos | spec.md §FR-LOC; browser-storage.md §§4–8 | Faltan umbrales concretos, confirmación de borrado, tamaño de importación y reglas de migración/duplicados. | Completar política de IndexedDB y UX de privacidad. |
| `H-I11` | **Importante** | Controles de borde HTTP incompletos | spec.md §CR-SEC; plan.md §AD-001; openapi.yaml | CORS, CSP, referrer, host allowlist, timeout y límites de body no están normados de extremo a extremo. | Agregar contrato de seguridad del gateway. |
| `H-I12` | **Importante** | Administración y HMAC incompletos | spec.md §FR-ADM; openapi.yaml; data-model.md §4.11 | Faltan canonicalización HMAC, skew, nonce TTL, replay store, staging/rollback y evidencia de permiso de display. | Completar contrato administrativo antes del incremento 5. |
| `H-M01` | **Menor** | Sufijo físico del ZIP cargado | Archivo físico de entrada | El archivo cargado se llama v0.6_plan(1).zip, aunque el directorio interno y contenido corresponden a v0.6_plan. | Mantener el nombre lógico declarado y evitar duplicados con sufijo en Fuentes del Proyecto. |
| `H-M02` | **Menor** | Dividend yield con alcance ambiguo | analysis-pipeline.md §8; spec.md §FR-VAL-004 | Aparece en pipeline como condicionado, pero no en el listado normativo de FR-VAL-004. | Declararlo dentro o fuera del MVP y definir fuente. |
| `H-M03` | **Menor** | Nomenclatura de acciones no uniforme | spec.md User Stories; PROJECT_CONTEXT.md | Se alternan “fundamentales” y “estados contables”. | Agregar glosario y etiquetas canónicas. |

## Resumen cuantitativo

- **Bloqueante**: 14
- **Importante**: 12
- **Menor**: 3

## Hallazgos aprobados destacados

- `A-001`: integridad del baseline y manifest original verificados.
- `A-002`: no existe dependencia funcional obligatoria de un servicio pago.
- `A-003`: arquitectura bajo demanda, browser-first y persistencia central mínima coherentes.
- `A-004`: prohibición de recomendaciones personalizadas, órdenes y promesas de rentabilidad consistente.
- `A-005`: acceso SEC y políticas de proveedores se modelan explícitamente, aunque la aplicabilidad contractual requiere cierre.
- `A-006`: topes internos de Cloudflare/D1 son conservadores frente a límites gratuitos vigentes al 2026-07-20.
- `A-007`: API personal, CSV y entrada manual existen como rutas de adquisición/degradación.
- `A-008`: no se generó `tasks.md`, código, dependencia ni build.
- `A-009`: procedencia SEC y modelo de persistencia local conservan campos de trazabilidad relevantes.
- `A-010`: no se permite conversión automática de moneda en el MVP.
- `A-011`: ningún documento previo fue corregido silenciosamente.
- `A-012`: el gate de salida impide avanzar a tareas con bloqueantes abiertos.
