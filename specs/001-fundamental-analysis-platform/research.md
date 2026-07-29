# Research y decisiones técnicas

**Revisión normativa del contenido:** v0.19.3  
**Paquete/fase activa:** v0.21

## 1. SEC EDGAR/XBRL

Las APIs públicas `data.sec.gov` no requieren autenticación ni API key. Submissions contiene historia de filings y referencias a archivos históricos adicionales; Company Facts reúne todos los conceptos estándar del emisor; Company Concept devuelve un concepto/taxonomía exactos. `data.sec.gov` no ofrece CORS, por lo que la UI client-side consume un gateway Worker read-only.

La SEC declara un máximo general de 10 requests por segundo y exige un User-Agent identificado. FinScope adopta un límite más conservador: concurrencia 1, presupuesto 14 por operación, timeout 20/120 s, 3 intentos y backoff 1/2/4 s.

**Fuentes oficiales:**

- `https://www.sec.gov/search-filings/edgar-application-programming-interfaces`
- `https://www.sec.gov/about/webmaster-frequently-asked-questions`
- endpoints registrados en `fixtures/sec/raw/manifest.json`.

## 2. Selección de facts

Company Facts es primario. Company Concept solo completa conceptos allowlisted con mapping exacto `ACTIVE`. Frames no selecciona facts de un emisor porque aproxima períodos calendario entre entidades. Forms, duplicados, amendments, restatements, units y conflicts se cierran en `contracts/sec-filing-fact-selection-policy.json`; nunca existe inferencia silenciosa.

## 3. Actualización y cache

El modelo elegido es foreground-on-open/resume. Sin `refreshConsent`, no hay red. La aplicación cerrada no ejecuta scheduler. Las bandas 6 h/7 d son operativas y no entran en fingerprints. La novedad se calcula sobre accession, form, filingDate, reportDate y primaryDocument.

## 4. Cálculos

`decimal.js` evita IEEE-754 normativo. Quince fórmulas cerradas definen expresiones, aridad, orden, edges, reason codes y serialización. Los resultados persisten a escala 12 con `ROUND_HALF_EVEN`; identidades exactas preservan el string canónico.

## 5. Arquitectura client-side

Svelte 5 + TypeScript estricto + Vite. La UI no calcula. Un Web Worker TypeScript ejecuta normalización, métricas, reglas y fingerprints mediante mensajes planos discriminados. IndexedDB publica candidatos atómicamente.

## 6. Seguridad y privacidad

El gateway restringe hosts/métodos/redirecciones y tamaños. El importador CSV valida archivo completo antes de persistir. CSP y headers se cierran en una autoridad machine-readable. Export/restore permanece local, valida schemas/hashes/referencias y no concede consentimientos.

## 7. Accesibilidad

WCAG 2.2 AA se transforma en oráculos verificables para teclado, foco, reflow, contraste, target size, errores, status messages y reduced motion. Playwright cubre lo automatizable y los puntos visuales conservan revisión manual explícita.

## 8. Determinismo de pruebas

Los fixtures SEC congelados, los 96 vectores métricos, 36 vectores de fórmulas, 84 escenarios AC y 81 combinaciones de estados son oráculos release-stable. Los smoke tests live son opcionales y no determinan release.

## 9. Gobierno

La Constitución prevalece. `V0.21_PHASE_STATUS.md` es el único gate activo. El workflow `generic` conserva la secuencia completa; v0.21 autoriza implementación de `tasks.md` y mantiene convergencia cerrada.

## Fuentes oficiales verificadas — 2026-07-21

Verificación realizada el **2026-07-21**:

- SEC Fair Access: `https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data` — máximo general 10 requests/s y User-Agent declarado con contacto.
- SEC EDGAR APIs: `https://www.sec.gov/search-filings/edgar-application-programming-interfaces` — `data.sec.gov`, sin autenticación ni API key, submissions y XBRL JSON.
- WCAG 2.2 Recommendation: `https://www.w3.org/TR/WCAG22/` — Level AA exige todos los criterios A y AA; inventario oficial de 55 criterios A/AA.
- Cloudflare Workers limits: `https://developers.cloudflare.com/workers/platform/limits/` — Free: 100,000 requests/day, 10 ms CPU/request, 128 MB, 50 subrequests, 3 MB Worker, 5 Cron.
- Cloudflare Pages limits: `https://developers.cloudflare.com/pages/platform/limits/` — Free: 20,000 files/site y 25 MiB/asset; Pages Functions consume cuota Workers.
- Cloudflare D1 pricing/limits: `https://developers.cloudflare.com/d1/platform/pricing/` y `https://developers.cloudflare.com/d1/platform/limits/` — Free: 5M rows read/day, 100k rows written/day, 5 GB account, 500 MB/database, 50 queries/invocation.
- Cloudflare KV limits: `https://developers.cloudflare.com/kv/platform/limits/` — documentado solo para justificar `NOT_USED`.
- Cloudflare Queues pricing/limits: `https://developers.cloudflare.com/queues/platform/pricing/` y `https://developers.cloudflare.com/queues/platform/limits/` — documentado solo para justificar `NOT_USED`.

Toda cuota debe revalidarse antes de deployment. El presupuesto activo adopta márgenes, canary thresholds y degradación controlada; ningún flujo requiere un plan pago.

## Vigencia del research para paquete v0.20

Este research conserva revisión normativa material **v0.19.3** y es autoridad activa dentro del paquete **v0.20**; fue revalidado el 2026-07-21. Todo paquete anterior es evidencia histórica.
