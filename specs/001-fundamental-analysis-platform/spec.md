# Especificación — FinScope Analytics fundamental-first

**Revisión normativa del contenido:** v0.19.3  
**Paquete/fase activa:** v0.21

**Estado:** `SPEC_AND_PLAN_BASELINE_FOR_TASKS`  
**Versión contractual:** `5.0.0`  
**Constitución:** 3.1.0  
**Gate:** `tasksAuthorized=true` | `analysisAuthorized=true` | `implementationAuthorized=true` | `convergenceAuthorized=false`
**Remediación:** v0.19.2 — cierre documental transversal de 3 BLOCKER, 4 MAJOR, 1 MINOR y 18 controles FAIL de v0.19.1; cerrada por checklist independiente v0.19.3; tareas generadas en v0.20 y remediadas/reanalizadas en v0.21

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

<a id="scope-and-non-goals"></a>
## Scope and non-goals

### Objetivo

Permitir que una persona investigue emisores registrados ante la SEC mediante un análisis fundamental reproducible, adaptable al perfil contable, con evidencia visible, cobertura explícita, métricas determinísticas e insights descriptivos basados en reglas.

### Dentro del MVP

- Selección inequívoca de emisor por CIK.
- Adquisición incremental SEC bajo demanda o con consentimiento explícito al abrir/reanudar.
- Company Facts como fuente primaria y Company Concept como fallback selectivo.
- Perfiles contables con allowlists explícitas.
- Mappings XBRL exactos, versionados y sin inferencias.
- 24 métricas fundamentales, 9 reglas e insights con limitaciones.
- Overlay histórico opcional de precio por CSV/entrada manual y 8 métricas descriptivas.
- Snapshots fundamentales inmutables y overlay independiente.
- Persistencia local opt-in y atómica en IndexedDB.
- Evidencia, fingerprints, estados y recuperación visibles.

### Fuera del MVP

- Valuación intrínseca o relativa.
- Price targets, buy/sell/hold, scoring de inversión o recomendaciones personalizadas.
- Cotización en tiempo real.
- Adaptadores automáticos de mercado.
- Scheduler central, snapshots públicos, portfolios multiusuario o ejecución de órdenes.
- Inferencia automática de mappings XBRL.

## Actores

- **Usuario personal:** selecciona emisor, consiente actualizaciones/persistencia, inspecciona resultados e importa precio.
- **Gateway SEC:** expone solo operaciones read-only alcanzables y Problem Details RFC 9457.
- **Orquestador local:** controla estados, cancelación, reanudación, análisis y publicación atómica.
- **Motor de análisis:** normaliza, calcula métricas, evalúa AST y fingerprints sin usar reloj local.

## Requisitos funcionales

### Identidad y adquisición

- **FR-001:** CIK de 10 dígitos es la identidad primaria; ticker es alias no autoritativo.
- **FR-002:** una coincidencia ambigua produce `identity_ambiguous` local; nunca selección automática.
- **FR-003:** una operación SEC tiene presupuesto fijo de 14 llamadas externas.
- **FR-004:** Submissions y Company Facts se solicitan antes de cualquier Company Concept.
- **FR-005:** Company Concept se solicita solo para conceptos no resueltos, allowlisted y con mapping exacto `ACTIVE`.
- **FR-006:** el orden de fallback es estable: allowlist del perfil → prioridad de métrica → precedencia de mapping → conceptId.
- **FR-007:** agotado el presupuesto, se publica resultado `partial` si hay payload utilizable; no se ejecuta una llamada 15.

### Normalización y cobertura

- **FR-008:** cada fact mantiene `factId`, concepto canónico, período, scope, decimal canónico, mapping/version y sourceRef.
- **FR-009:** los estados de fact resolution son `resolved|absent|ambiguous|incompatible`.
- **FR-010:** la cobertura agregada usa `complete|partial|missing|not_applicable`; no sustituye al estado del fact.
- **FR-011:** perfiles aplican allowlists de conceptos y métricas; elementos fuera de allowlist son `not_applicable` o `absent`, nunca inferidos.
- **FR-012:** `unsupported_profile` es un resultado local normal que conserva identidad, filings y evidencia; no es HTTP 422.

### Métricas, calidad y reglas

- **FR-013:** el catálogo ejecutable contiene exactamente 24 métricas fundamentales activas y 8 de precio activas.
- **FR-014:** cada métrica declara fórmula, inputs, prioridad, perfiles, calidad mínima, rounding, consumidores y dominio de fingerprint.
- **FR-015:** deuda usa buckets exactos no solapados; un total genérico o lease-inclusive no se usa sin mapping exacto explícito.
- **FR-016:** calidad fundamental y calidad de precio son modelos distintos y no comparten ejes implícitos.
- **FR-017:** cada una de las 9 reglas activas usa AST validado por `rule-node.schema.json`, perfiles, calidad mínima y consumidores.
- **FR-018:** cada regla tiene tres fixtures: triggered, not_triggered y not_evaluable.
- **FR-019:** una regla nunca se evalúa si un input requerido está indisponible o por debajo de la calidad mínima.

### Separación fundamental/precio

- **FR-020:** un bundle/snapshot fundamental no contiene overlay, métricas ni fingerprints de precio.
- **FR-021:** un overlay es inmutable por versión; reemplazarlo crea nueva versión y actualiza solo el pointer de precio.
- **FR-022:** importar o borrar precio no modifica bundle, análisis, snapshot ni pointer fundamental.
- **FR-023:** precio se usa únicamente para métricas históricas descriptivas; no interviene en reglas fundamentales.
- **FR-024:** `displayAgeDays`, `evaluationDate` y cualquier dato derivado del reloj son solo de presentación.

### Fingerprints y evidencia

- **FR-025:** serialización canónica RFC 8785 JCS y SHA-256 con prefijo `sha256:`.
- **FR-026:** `fundamentalInputFingerprint`, `fundamentalAnalysisFingerprint`, `historicalPriceOverlayFingerprint`, `priceAnalysisFingerprint` y `sourceEvidenceFingerprint` tienen proyecciones distintas.
- **FR-027:** fingerprints, timestamps de visualización y campos de reloj quedan excluidos de su propia proyección.
- **FR-028:** cambiar evidencia opcional o precio no cambia fingerprints fundamentales.
- **FR-029:** toda publicación valida fingerprints contra test vectors.

### Actualización y persistencia

- **FR-030:** apertura/reanudación usa snapshot local sin red cuando `refreshConsent=false`.
- **FR-031:** con `refreshConsent=true`, apertura/reanudación aplica cache determinística: `fresh <6h` sin red, `stale_revalidatable 6h–<7d` consulta Submissions primero, y `expired ≥7d` intenta actualizar preservando el último snapshot válido; Company Facts solo se solicita ante novedad, cache miss, cambio de autoridad dependiente o refresh manual.
- **FR-032:** el usuario siempre dispone de **Actualizar fundamentales**, que fuerza una comprobación puntual; no existe scheduler ni actualización mientras la aplicación está cerrada.
- **FR-033:** cambios de mappings/métricas/reglas invalidan solo dependencias afectadas.
- **FR-034:** IndexedDB publica candidatos mediante una única transacción atómica y compare-and-swap de pointer.
- **FR-035:** fallo/cancelación deja los pointers previos intactos y no crea huérfanos.
- **FR-036:** antes del borrado total existe exportación/restauración local versionada con preview; borrar precio preserva fundamentales y borrar todos los datos es atómico, confirmado y reversible mediante un backup válido.

### Estados, errores y accesibilidad

- **FR-037:** pipeline usa una única matriz de transiciones; toda transición no listada está prohibida.
- **FR-038:** states de facts, cobertura, métricas y pipeline son enums separados.
- **FR-039:** solo el gateway emite Problem Details; identidad ambigua, cancelación, quality gate y consentimiento son issues locales.
- **FR-040:** OpenAPI expone exactamente la matriz operación×status×variant; 409 y 422 no forman parte de la superficie activa.
- **FR-041:** cada estado/error preserva y bloquea capabilities explícitas y ofrece recuperación UI alcanzable.
- **FR-042:** cambios de estado, errores, limitaciones y confirmaciones destructivas cumplen los oráculos aplicables de `wcag-2.2-aa-matrix.json`, son anunciables, operables por teclado, con foco no obstruido y reduced motion.

## Requisitos no funcionales

- **NFR-001 Determinismo:** mismos inputs/versiones producen mismos outputs/fingerprints.
- **NFR-002 Privacidad:** datos personales permanecen locales salvo requests SEC explícitos.
- **NFR-003 Fair access:** User-Agent/contacto obligatorios, concurrencia 1, máximo 14 llamadas por operación, 3 intentos lógicos, backoff 1/2/4 s, request timeout 20 s, operación 120 s y respuesta máxima 64 MiB.
- **NFR-004 Resiliencia:** el último snapshot válido permanece utilizable ante fallos.
- **NFR-005 Testabilidad:** JSON, schemas, OpenAPI, referencias, fixtures y crosswalk son validables sin código de producto.
- **NFR-006 Trazabilidad:** cada dominio tiene autoridad primaria y consumidores bidireccionales.
- **NFR-007 Accesibilidad:** WCAG 2.2 AA es requisito verificable según 21 oráculos release-blocking; reduced motion se trata además como requisito de producto.

## Criterios de aceptación

La autoridad es `definitions/acceptance-criteria-catalog.json`, con 84 criterios y un único oráculo por criterio. Cada AC incluye `requirementIds[]`, autoridad y un RFC 6901 `fixtureRef` resoluble. La matriz reversible es `governance/requirements-acceptance-traceability.json`.

## Decisiones de tecnología

La autoridad normativa para tecnologías de implementación es `decisions/`:

- **Aritmética decimal:** `decimal.js` v10+, MIT — `decisions/decimal-library.md` (AUTH-026). Toda aritmética financiera usa esta librería y persiste `DecimalString`; ningún cálculo normativo usa `Number` IEEE-754.
- **UI client-side:** Svelte 5 + TypeScript + Vite — `decisions/ui-framework.md` (AUTH-027).
- **Pruebas:** Vitest para unidades/contratos y Playwright para E2E/accesibilidad. Las 15 fórmulas resuelven en `definitions/formula-catalog.json`.
- **Separación:** Svelte no se ejecuta dentro del Web Worker; el intercambio usa mensajes planos.

## Políticas normativas cerradas en la revisión de contenido v0.19.3

- **SEC:** Company Facts primario; Company Concept fallback exacto; Frames no selecciona facts. 10-K/Q, 20-F, 6-K, 40-F y amendments son elegibles; 8-K/A es evidencia únicamente. Duplicados, amendments, restatements y conflictos siguen `contracts/sec-filing-fact-selection-policy.json`.
- **Fórmulas:** 15 `FormulaDefinition` cerradas, `decimal.js`, escala 12 y `ROUND_HALF_EVEN`; estados no disponibles omiten valor y exigen reason code.
- **Precio:** scope por CIK, instrumento, MIC, moneda, frecuencia, overlayVersion y ventana; nunca scope contable consolidado.
- **Seguridad:** límites exactos en `contracts/security-and-input-limits.json`; CSV completo se valida antes de IndexedDB.
- **Privacidad:** export/restore es local, transaccional y no concede consentimiento de red.

### Autoridades y trazabilidad

Cada AC usa `authorityId` como identidad normativa y `authorityRef` como evidencia exacta relativa a `packageRoot`; toda resolución heurística está prohibida. Los 49 FR/NFR tienen `planRef`, sección, componente, contratos, schemas, estrategia de prueba y ACs, con reversibilidad exacta en `governance/requirements-acceptance-traceability.json`.

### Accesibilidad completa

`definitions/wcag-2.2-aa-matrix.json` inventaría los 55 criterios WCAG 2.2 A/AA, clasifica 43 como `APPLICABLE` y 12 como `NOT_APPLICABLE` con justificación y trigger de reclasificación. La omisión de un criterio o una falsa N/A bloquea release.

## Gate de fase

La autoridad única activa es `V0.21_PHASE_STATUS.md`. La especificación, aclaración, plan, checklist, tareas y análisis post-tareas están cerrados documentalmente para esta transición.

- `tasksAuthorized=true`; `tasks.md` existe, fue remediado y su QA es conforme.
- `analysisAuthorized=true`; el reanálisis post-tareas v0.21 es conforme.
- `implementationAuthorized=true` y `convergenceAuthorized=false`.
- Después de la implementación futura, la fase constitucional siguiente es convergencia; T109 solo prepara su evidencia de entrada.
- Ningún documento de v0.20 o anterior puede reabrir gates ni sustituir esta autoridad.

## Política explícita de comparabilidad v0.19.3

La comparabilidad exige moneda, unidad, escala, signo, FY, periodo trimestral, TTM, restatement handling, quality, confidence y lineage explícitos. Los snapshots fundamentales inmutables y el overlay de precio separado conservan fingerprints independientes del precio y del reloj local.
