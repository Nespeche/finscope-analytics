# Aclaraciones y decisiones cerradas

**Revisión normativa del contenido:** v0.19.3  
**Paquete/fase activa:** v0.21

**Estado:** `ALL_MATERIAL_AMBIGUITIES_CLOSED_AND_CONSUMED_BY_TASKS`  
**El paquete v0.21 autoriza implementación de las tareas remediadas; convergencia permanece cerrada.**

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

| ID | Decisión cerrada | Alternativas descartadas | Autoridad |
|---|---|---|---|
| CLR-001 | Análisis fundamental y precio son dos dominios independientes. | Snapshot combinado; fingerprint global. | `schemas/analysis-results.schema.json`; `contracts/fingerprint-projections.json` |
| CLR-002 | Snapshots fundamentales son inmutables. | Mutar snapshot activo al importar precio. | `contracts/browser-storage-contract.json` |
| CLR-003 | Overlay de precio es inmutable por versión y tiene pointer propio. | Overlay embebido; reemplazo in-place. | `schemas/historical-price-overlay.schema.json` |
| CLR-004 | Datos del reloj local no se persisten ni fingerprintan. | Guardar `displayAgeDays`. | schema de overlay y proyecciones |
| CLR-005 | Company Facts es la fuente primaria. | Company Concept masivo. | `sec-acquisition-policy.json` |
| CLR-006 | Company Concept es fallback selectivo, exacto y máximo 12 llamadas después de 2 llamadas base. | Scraping/fuzzy mapping; más de 14 llamadas. | política SEC y fixtures |
| CLR-007 | Perfiles tienen allowlists explícitas de conceptos y métricas. | Heurísticas sectoriales abiertas. | `accounting-profile-catalog.json` |
| CLR-008 | `unsupported_profile` es resultado local degradado, no error HTTP. | HTTP 422; salida dual. | catálogos de perfil y problemas |
| CLR-009 | Estados de fact, cobertura, métrica y pipeline son dominios distintos con traducción explícita. | Enum único sobrecargado. | `state-and-capability-catalog.json` |
| CLR-010 | Deuda es suma de buckets exactos no solapados; total genérico deshabilitado. | Inferir un total por nombre parecido. | `xbrl-mapping-catalog.json#debtPolicy` |
| CLR-011 | 32 métricas activas tienen prioridad, input, fórmula y fixtures. | Filas Markdown interpretables. | `metric-catalog.json`; 96 fixtures |
| CLR-012 | Las 9 reglas usan AST JSON cerrado y tres fixtures cada una. | Pseudocódigo o texto libre. | rule schema/catalog; 27 fixtures |
| CLR-013 | Calidad de precio tiene ejes propios. | Reutilizar ejes XBRL. | `quality-model-catalog.json#historicalPrice` |
| CLR-014 | Problem Details es solo gateway; issues locales tienen catálogo separado. | 409 genérico para estados de UI. | ambos catálogos y schemas |
| CLR-015 | OpenAPI contiene solo errores alcanzables por operación. | `oneOf` global; 409/422 imposibles. | OpenAPI + operationMatrix |
| CLR-016 | Persistencia usa commits atómicos y compare-and-swap de pointers. | Escribir records y pointer por separado. | browser storage contract |
| CLR-017 | Apertura/reanudación requiere consentimiento para red; actualización manual siempre disponible. | Polling/scheduler silencioso. | incremental events catalog |
| CLR-018 | No se preserva el conteo 77; v0.19 mantiene 84 criterios por cobertura real. | Objetivo numérico artificial. | acceptance catalog |
| CLR-019 | Valuación y recomendaciones quedan fuera del MVP. | múltiplos/DCF/señales de compra. | spec; replacement register |
| CLR-020 | Constitución 3.1.0 centraliza el gobierno de gates y elimina la autorización unilateral desde documentos subordinados. | Mantener 3.0.0 con prohibición absoluta; abrir implementación desde spec/phase status. | `.specify/memory/constitution.md`; `V0.20_PHASE_STATUS.md` |

| CLR-021 | La UI futura usa Svelte 5 + TypeScript + Vite; Vitest y Playwright son las herramientas de prueba. | React; Vue; SvelteKit/SSR. | `decisions/ui-framework.md` |
| CLR-022 | El `tasks.md` v0.18 queda superseded y no es activo; las tareas se regenerarán solo después del checklist. | Reparación parcial del borrador prematuro. | `V0.20_PHASE_STATUS.md`; evidencia histórica v0.19 |
| CLR-023 | Red/refresh, persistencia local e importación de precio usan consentimientos y acciones distintas. | Un único flag ambiguo para red y storage. | `contracts/update-orchestration.md`; `contracts/browser-storage-contract.json` |
| CLR-024 | Pruebas obligatorias usan fixtures SEC congelados; emisores reales son smoke tests opcionales no determinísticos. | Apple/bancos live como criterio de DONE. | `plan.md`; `fixtures/sec/` |

## Ambigüedades menores futuras

La fase de tareas v0.21 conserva nombres y rutas futuras y remedia sus dependencias ejecutables. Cualquier cambio material de alcance, tecnología, cobertura regulatoria o contratos deberá regresar a especificación, aclaración, plan y checklist antes de modificar tareas.


## Decisiones cerradas de remediación v0.19.2

| ID | Decisión cerrada | Autoridad |
|---|---|---|
| CLR-037 | `.specify` usa exclusivamente `generic` y el workflow incluye las nueve fases con gate previo. | `.specify/workflows/`; `.specify/integration.json` |
| CLR-038 | Cada AC contiene `requirementIds[]`, autoridad y fixture RFC 6901 resoluble; existe matriz forward/reverse. | acceptance catalog; requirements traceability |
| CLR-025 | Las 15 fórmulas son definiciones ejecutables cerradas con decimal.js, escala 12 y HALF_EVEN. | `definitions/formula-catalog.json` |
| CLR-026 | La actualización automática ocurre solo al abrir/reanudar con consentimiento; nunca con la app cerrada. | `contracts/cache-and-refresh-policy.json` |
| CLR-027 | Cache: fresh <6h; stale 6h–<7d; expired ≥7d; Submissions detecta novedad antes de Company Facts. | cache/refresh policy |
| CLR-028 | Company Facts es primario; Company Concept es fallback exacto; Frames no selecciona facts de un emisor. | SEC selection policy |
| CLR-029 | 8-K/A es solo evidencia; forms, amendments, restatements, duplicados y conflictos tienen precedencia cerrada. | SEC selection policy |
| CLR-030 | Los fixtures SEC oficiales son extractos acotados congelados, hasheados y versionados; live smoke es opcional. | `fixtures/sec/raw/manifest.json` |
| CLR-031 | Gateway, CSV y headers tienen límites cuantificados; no se incluyen valores de User-Agent/contacto en el paquete. | security/input limits |
| CLR-032 | Todo módulo futuro es TypeScript estricto; Web Worker usa mensajes discriminados; no hay módulos normativos JS. | `decisions/ui-framework.md` |
| CLR-033 | WCAG 2.2 AA inventaría los 55 criterios A/AA: 43 aplicables release-blocking y 12 NOT_APPLICABLE con justificación individual; 2.3.3 permanece requisito adicional. | WCAG matrix |
| CLR-034 | Las métricas de precio usan scope de overlay/instrumento, nunca scope de consolidación contable. | metric catalog |
| CLR-035 | Exportación y restauración local requieren preview, hashes, schemas, consentimiento de almacenamiento y transacción atómica. | local export/restore contract |
| CLR-036 | Hecho histórico de v0.19.2: `tasks.md` estaba ausente y la fase siguiente era checklist. Queda superseded por CLR-044 y CLR-051 para el paquete v0.20. | evidencia histórica v0.19.2; `V0.20_PHASE_STATUS.md` |


## Decisiones adicionales de v0.19.2

| ID | Decisión cerrada | Autoridad |
|---|---|---|
| CLR-039 | `authorityId` es identidad canónica; `authorityRef` es evidencia exacta desde `packageRoot`; toda heurística falla cerrada. | acceptance catalog; authority crosswalk |
| CLR-040 | Fórmulas evalúan aridad → ausencia → invalidez → no canonicidad → insuficiencia → denominador cero → resultado no disponible. | formula catalog |
| CLR-041 | Los 49 FR/NFR se vinculan explícita y reversiblemente con un único componente y anchor del plan. | requirements traceability; plan |
| CLR-042 | Hecho histórico de v0.19.2: esa versión fue activa y v0.19.1 su baseline inmediato. Queda superseded por CLR-044 y CLR-051. | evidencia histórica; replacement register |

## Índice verificable de aclaraciones

La identidad normativa es el ID. Deben existir exactamente una vez `CLR-001` a `CLR-051`; las decisiones originales `CLR-023` y `CLR-024` no fueron sobrescritas. Las dos filas duplicadas fueron renumeradas como `CLR-037` y `CLR-038`.

### CLR-043 — Orden de argumentos y normalización OLS

**Decisión:** `ratio_change` usa `[current, prior]`; `normalized_ols_ordinal` calcula la pendiente OLS sobre `price/firstPrice`. Se prohíbe reinterpretar el orden posicional o normalizar por la media. Esta aclaración elimina ambigüedad del oráculo independiente sin alterar los 36 vectores normativos.


## Decisiones de transición v0.20

| ID | Decisión cerrada | Evidencia/consumidores |
|---|---|---|
| CLR-044 | v0.20 es versión del paquete/fase; spec, aclaración, research y plan conservan revisión material v0.19.3. | START_HERE; phase status; metadata |
| CLR-045 | MVP SEC-only y CIK-first. CNV, empresas globales no SEC, ETF y cobertura de instrumentos independiente del emisor quedan post-MVP. | spec; architecture report; tasks |
| CLR-046 | ADR solo puede mostrarse como alias/overlay cuando el emisor está resuelto por CIK; no amplía cobertura regulatoria. | data model; price overlay |
| CLR-047 | Precio del MVP es CSV/entrada manual. No hay proveedor automático, BYO-key ni promesa de cotizaciones. | constitution IX; import contract |
| CLR-048 | No hay automatización con la aplicación cerrada. Apertura/reanudación con consentimiento y botones de dominio son los únicos disparadores de red. | FR-030..032; update orchestration |
| CLR-049 | Gateway sin framework HTTP adicional; visualización HTML/SVG accesible; IndexedDB nativo; Ajv para Draft 2020-12 y axe solo como complemento automatizado. | plan; tasks |
| CLR-050 | D1 requiere una única migración mínima para metadata pública de catálogos; nunca guarda payloads financieros personales. | plan; Cloudflare budget; tasks |
| CLR-051 | Hecho histórico: v0.20 fue el baseline activo con implementación cerrada. Queda superseded por CLR-052 para v0.21. | phase status v0.20; documentación histórica; tasks QA v0.20 |

## Decisión post-análisis v0.21

| ID | Decisión cerrada | Evidencia/consumidores |
|---|---|---|
| CLR-052 | v0.21 es el baseline activo; v0.20 es el baseline histórico inmediato. `tasksAuthorized=true`, `analysisAuthorized=true`, `implementationAuthorized=true` y `convergenceAuthorized=false`. Después de implementación la fase siguiente es convergencia. | `V0.21_PHASE_STATUS.md`; `tasks.md`; `reports/v0.21/` |
