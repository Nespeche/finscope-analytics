<!--
Sync Impact Report

- Version change: 3.0.0 -> 3.1.0.
- Bump rationale: minor governance amendment. Product principles remain unchanged; a new,
  binding Spec-Driven phase-gate section resolves the contradiction that allowed subordinate
  documents to open tasks or implementation without the required checklist and analysis.
- Modified principles: none of Principles I-XI changed semantically.
- Added section: XII. Spec-Driven phase gates and single gate authority.
- Governance updated: the active phase-status file identified by DOCUMENTATION_INDEX.md is the
  sole package gate authority; subordinate artifacts cannot broaden its authorization.
- Current v0.19.1 gate: specification/clarification/plan/checklist authorized; tasks, analysis,
  implementation and convergence not authorized.
- Dependent active artifacts synchronized for v0.19.1: entry docs, `V0.19.1_PHASE_STATUS.md`,
  specification, clarification, research, plan, contracts, schemas, fixtures, governance and metadata.
- Spec Kit workflow/registry/integration were modified under explicit authorization: only `generic`
  remains and every constitutional phase now checks the active gate before execution.
- Superseded artifact: the v0.18 tasks draft remains historical; no active `tasks.md` exists in v0.19.1.
-->

# Constitución de FinScope Analytics

**Versión:** 3.1.0  
**Ratificada:** 2026-07-20  
**Última enmienda:** 2026-07-21

<a id="core-principles"></a>

## I. Fundamental-first y primacía regulatoria

1. Los fundamentales son el núcleo obligatorio del producto.
2. SEC EDGAR/XBRL es la fuente estructurada principal del MVP.
3. El sistema DEBE conservar filing, período, moneda, unidad, scope, taxonomía, tag,
   accession number, fecha de presentación y lineage de revisión.
4. Una ausencia legítima NO DEBE convertirse en un error global: se representa como
   `insufficient` o `not_applicable` según corresponda.
5. El producto NO DEBE emitir recomendaciones de inversión, órdenes, objetivos de precio
   ni promesas de rentabilidad.

## II. Identidad autoritativa del emisor

1. El CIK normalizado a diez dígitos es la identidad primaria del emisor SEC.
2. El ticker, nombre comercial, símbolo o MIC son aliases informativos y temporales.
3. Un alias nunca PUEDE sustituir al CIK como clave de adquisición o persistencia.
4. Una identidad ambigua DEBE detener el flujo con `identity_ambiguous`; nunca se adivina.

## III. Adquisición on-demand y consentimiento

1. No se precarga el universo SEC.
2. La adquisición se inicia al seleccionar un emisor, mediante `manual_refresh` o con
   consentimiento previo de actualización al abrir o reanudar la aplicación.
3. Abrir o reanudar sin consentimiento NO DEBE generar solicitudes externas.
4. Company Facts es la fuente principal de hechos XBRL.
5. Company Concept solo puede utilizarse como fallback selectivo bajo condiciones
   normativas cerradas y presupuesto único.

## IV. Perfiles contables y sectoriales

1. El análisis DEBE adaptarse mediante perfiles versionados:
   `general_operating_us_gaap`, `general_operating_ifrs_limited`,
   `financial_institution_limited`, `insurance_limited`, `reit_limited` y
   `unsupported_profile`.
2. Solo `general_operating_us_gaap` aspira inicialmente al pack fundamental completo.
3. Los perfiles limitados publican únicamente métricas expresamente allowlisted.
4. Un mapping ambiguo nunca se adivina.
5. Una métrica incompatible se publica como `not_applicable`; una métrica compatible
   con inputs insuficientes se publica como `insufficient`.

## V. Arquitectura y separación de responsabilidades

1. Cloudflare Pages sirve la interfaz estática.
2. Cloudflare Worker funciona como gateway SEC liviano: valida, aplica límites, cachea y
   retransmite respuestas permitidas; no ejecuta normalización contable intensiva.
3. La normalización, resolución de mappings, métricas e insights se ejecuta en Web Worker.
4. D1 se limita a metadata, catálogos, versiones, mappings y políticas; no almacena
   histories masivos, raw SEC completos ni análisis personales.
5. El análisis personal y los snapshots permanecen locales en IndexedDB con consentimiento.

## VI. Trazabilidad, fingerprints y reproducibilidad

1. Toda salida DEBE permitir recorrer fuente -> filing -> fact -> mapping -> métrica ->
   regla -> síntesis -> snapshot.
2. Valores financieros se normalizan como strings decimales antes de canonicalizar.
3. Los fingerprints usan JCS RFC 8785, SHA-256, allowlists únicas, arrays en orden
   normativo, ausencia distinta de `null`, rechazo de NaN/Infinity y normalización de `-0`.
4. La evidencia opcional no modifica resultados ni fingerprints de entrada o salida.
5. Mismas entradas allowlisted y mismas versiones DEBEN producir los mismos bytes y salida.

## VII. Calidad determinística sin score

1. La calidad se expresa mediante `DataQualityProfile` categórico.
2. No existen `rawScore`, `score`, pesos, caps, gates o bandas numéricas de confianza.
3. La clasificación `verified|usable_with_caveats|insufficient` es una función total y
   sin solapamientos de mapping, completitud, comparabilidad y revisión.
4. Una combinación ambigua, missing, incompatible o conflicted siempre es `insufficient`.

## VIII. Métricas e insights tipados

1. Una métrica solo puede estar activa con inputs, períodos, scope, unidad, estados,
   calidad, fingerprint y consumidores cerrados.
2. Deuda y EBITDA siguen definiciones únicas; deuda parcial bloquea ratios dependientes.
3. Los insights usan exclusivamente un AST cerrado: `all`, `any`, `count_at_least`,
   `comparison`, `metric_state_is` y `quality_is_at_least`.
4. Cada regla produce `triggered|not_triggered|not_evaluable`.
5. La síntesis es total: `insufficient_information|neutral|favorable|unfavorable|mixed`.
6. El producto no inventa facts, mappings, métricas, reglas ni conclusiones.

## IX. Mercado opcional y no bloqueante

1. La capa de mercado es opcional y se modela como `HistoricalPriceOverlay`.
2. Sus series pueden ser `single`, `daily`, `weekly`, `monthly`, `quarterly` o `irregular`.
3. No se requieren cotizaciones en tiempo real, diarias ni semanales.
4. El mercado puede cargarse mediante CSV o entrada manual desde la UI.
5. Proveedores automáticos, credenciales BYO-key, entitlement, cuotas, refresh automático,
   calendarios bursátiles y venue registry están fuera del MVP.
6. No existe `valuation_eligible`; toda observación de mercado es descriptiva y nunca
   bloquea fundamentales.
7. Valuación dependiente del precio está fuera del MVP.

## X. Snapshots locales y operación desde UI

1. `PersonalAnalysisSnapshot` es inmutable.
2. La activación local se realiza atómicamente en una transacción IndexedDB que persiste
   candidato, índice de evidencia y `activeSnapshotId`; ante fallo conserva el pointer previo.
3. Todos los flujos ordinarios operan desde la interfaz: descubrir emisor, actualizar,
   cancelar, importar precio, revisar preview, confirmar, borrar y gestionar consentimiento.
4. La terminal no es requisito de usuario.
5. Publicación central automática, scheduler público, active snapshot D1 público,
   invalidación ETag por publicación y GitHub Actions como runtime de ingestión están fuera
   del MVP.

## XI. Seguridad, privacidad, accesibilidad y sostenibilidad

1. No se almacenan secretos, API keys, tokens, cookies ni credenciales de mercado.
2. Los payloads y archivos se validan por tamaño, tipo, estructura y límites antes de uso.
3. La interfaz DEBE cumplir WCAG 2.2 AA para teclado, foco, labels, estados busy,
   `aria-live`, cancelación, recuperación y confirmaciones destructivas.
4. Se priorizan capacidades gratuitas permanentes; toda dependencia externa DEBE tener
   presupuesto, degradación y política documentada.
5. Las extensiones futuras son no normativas hasta una enmienda constitucional y una fase
   Spec-Driven completa.

## XII. Spec-Driven phase gates and single gate authority

1. El orden obligatorio es: constitución → especificación → aclaración → plan → checklist →
   tareas → análisis → implementación → convergencia.
2. El archivo de estado de fase vigente identificado por `DOCUMENTATION_INDEX.md` es la
   única autoridad del paquete para los flags de autorización.
3. Ningún documento subordinado, reporte histórico, checklist anterior o metadata PUEDE
   ampliar un gate cerrado por la autoridad de fase vigente.
4. `tasks.md` solo PUEDE existir como artefacto activo después de un checklist formal
   independiente con decisión `APPROVED_FOR_TASKS` y sin hallazgos bloqueantes o mayores.
5. La implementación solo PUEDE abrirse después de que `spec.md`, `plan.md` y `tasks.md`
   sean consistentes y un análisis transversal post-tareas concluya sin bloqueantes.
6. Convergencia y release solo PUEDE abrirse después de implementación incremental,
   validaciones contractuales, seguridad, accesibilidad y cierre de hallazgos residuales.
7. Los artefactos de fases anteriores se preservan como evidencia histórica y nunca
   sustituyen a las autoridades activas del baseline exclusivo.

## Gobierno

- Toda modificación constitucional requiere versión semántica, Sync Impact Report y
  sincronización de autoridades y consumidores.
- La Constitución prevalece sobre especificación, plan, contratos, definiciones y tareas.
- El archivo de fase activo gobierna la autorización corriente dentro de estas reglas.
- Cada transición de gate requiere evidencia formal de la fase inmediatamente anterior.
