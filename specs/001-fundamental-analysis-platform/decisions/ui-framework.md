# Decision: Svelte 5 + TypeScript strict + Vite

**Estado:** Accepted  
**Versión:** 1.2.0  
**Fecha:** 2026-07-22  
**Autoridad:** AUTH-027

## Decisión

La implementación es client-side con Svelte 5, TypeScript estricto y Vite. Vitest cubre unidad/integración/contrato/negativos/rendimiento no-browser; Playwright cubre E2E, accesibilidad automatizada y rendimiento browser. Todo módulo normativo es `.ts` o `.svelte` con TypeScript.

## Reglas obligatorias

- `tsconfig` con `strict`, `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes`.
- `vite.config.ts`, no JavaScript ni SvelteKit.
- Cloudflare Worker/gateway en TypeScript.
- Web Worker como módulo TypeScript separado; Svelte no se ejecuta dentro del Worker.
- Mensajes UI↔Worker como uniones discriminadas exhaustivas con `requestId`, `type` y payload validado.
- Ningún `any` en APIs de dominio; inputs externos empiezan como `unknown`.
- Aritmética financiera exclusivamente con `decimal.js`.
- No React, framework HTTP adicional, router externo ni librería gráfica obligatoria.

<a id="composition-roots"></a>
## Composition roots obligatorios

### Bootstrap y shell

1. `src/main.ts` es el único bootstrap browser y debe montar `src/app/App.svelte` sobre `#app`.
2. `App.svelte` es el único composition root visual. No contiene reglas financieras, adquisición SEC ni persistencia.
3. `src/app/composition.ts` define registros tipados y orden determinístico.
4. Ningún lote futuro puede crear una vista/acción/plugin que no sea alcanzable desde estos composition roots.

### Registro de vistas

- Vite descubre `src/app/views/*.svelte` mediante `import.meta.glob` en el composition root.
- Cada vista exporta desde `<script module lang="ts">` una `routeDefinition` con `id`, `label`, `order` y capacidades requeridas.
- IDs duplicados, metadata ausente o import no determinístico bloquean build/contract tests.
- `HomeView` existe desde T004; futuras vistas se incorporan sin reescribir `src/main.ts` ni crear routers ad hoc.

### Componentes globales, acciones, plugins y estilos

- Componentes globales exportan `appPlacement` (`header`, `primary-action`, `status`, `recovery`, `footer`) y `order`; los demás componentes no se auto-renderizan.
- Módulos `src/app/lifecycle/*.ts` y `src/app/a11y/*.ts` exportan `installAppPlugin(context)` idempotente y una clave única.
- Estilos bajo `src/app/styles/*.css` se cargan por glob eager determinístico; no dependen de imports ocultos en una vista.
- El registro rechaza claves duplicadas, side effects antes de `installAppPlugin` y orden dependiente del filesystem.

### Web Worker

`src/worker/orchestrator.worker.ts` es el único entrypoint del Worker. Los módulos de operación exportan un descriptor tipado (`operationType`, `handle`) y son descubiertos/validados determinísticamente. T033 y T048 deben quedar alcanzables desde el orquestador sin switches duplicados ni imports opcionales silenciosos.

### Gateway SEC

`workers/sec-gateway/src/index.ts` es el único entrypoint HTTP. Las rutas OpenAPI se registran explícitamente en una tabla cerrada; T027 debe actualizar ese entrypoint al crear las rutas. Ningún archivo de ruta auto-publica endpoints por side effect.

<a id="test-discovery"></a>
## Descubrimiento de pruebas

- Vitest: `tests/unit/**/*.test.ts`, `tests/integration/**/*.test.ts`, `tests/contract/**/*.test.ts`, `tests/negative/**/*.test.ts`, `tests/performance/**/*.test.ts`.
- Playwright: `tests/e2e/**/*.spec.ts`, `tests/accessibility/**/*.spec.ts`, `tests/performance/**/*.spec.ts`.
- Helpers `.ts` y evidencia `.md` no cuentan como pruebas ejecutadas.
- Un contrato de B01 valida que todos los paths de prueba declarados por T001–T109 sean descubribles por exactamente un runner.
- `passWithNoTests` nunca prueba el Done when de una tarea; el cierre exige que los archivos esperados existan y aparezcan en la salida del runner.

## Estructura esperada

```text
src/
  main.ts
  app/App.svelte
  app/composition.ts
  app/views/*.svelte
  app/components/*.svelte
  app/lifecycle/*.ts
  app/a11y/*.ts
  app/styles/*.css
  types/messages.ts
  core/*.ts
  domain/fundamental/*.ts
  domain/price/*.ts
  gateway/*.ts
  persistence/*.ts
  worker/orchestrator.worker.ts
workers/sec-gateway/src/index.ts
vite.config.ts
tsconfig.json
```

## Justificación

Los registros tipados evitan que lotes paralelos compitan por `App.svelte`, `src/main.ts` o el orquestador y eliminan componentes no alcanzables. Los entrypoints explícitos del gateway preservan la superficie OpenAPI cerrada. La separación de runners impide falsos PASS por tests fuera de `testDir`.
