# B06 r2 — Análisis de fallo y remediación r3

**Estado:** `R3_IMPLEMENTED_PENDING_EXTERNAL_VALIDATION`  
**Autoridad:** evidencia técnica; no modifica FR/NFR/AC ni abre B07.

## Entradas autenticadas

| Elemento | SHA-256 | Resultado |
|---|---|---|
| `FS_B06_r2.zip` | `307ee9ec13aa8de2c57a993a33beba06308abcc4d90696b924013cd468d7f829` | candidato r2 íntegro |
| `Run-FinScope-BatchValidation_B06_r2_v1.ps1` | `2fa388fb0d6744a9d1f86d21e6a0c970294550ef9d6413fd9d6fdeb1812546d8` | runner r2 íntegro |
| `FinScope_local_evidence_B06_20260726-122752787_FAILED.zip` | `c73c994cee64dc9fc97838e1951d9b89ee02cf3bfd2f95c9c2480cb5e6052586` | evidencia externa FAIL íntegra |
| preflight r2 | `ff472a95a3255ade0857c417f7a115ae8dae30232c663c385faade2ab9bdf9be` | PASS antes de npm |

## Resultado demostrado

El preflight validó candidato, runner, CRC, raíz, rutas, manifiesto, inventario, metadata, `.specify`, gates y plano de control `994/994 PASS`. También pasaron `npm ci`, instalación de Chromium, typecheck, unidad, integración, contrato y negativos. `test-e2e` falló; fail-fast dejó la regresión Vitest, la regresión browser y build como `NOT_RUN`.

Playwright ejecutó seis casos por la concatenación del script `test:e2e` con el argumento adicional. Cuatro casos heredados pasaron. El caso `issuer-selection.spec.ts` falló en desktop y mobile porque, después de pulsar `Issuer search`, no apareció el encabezado `Select an issuer`.

## Causa funcional

`App.svelte` usa reactividad tradicional (`let` y `$:`), pero renderizaba la vista activa mediante una variable de componente (`<ActiveView />`). En ese modo de Svelte el cambio de variable no reemplaza automáticamente la instancia visual. `activeRouteId` cambiaba, pero `HomeView` seguía montada.

r3 usa el mecanismo explícito compatible:

```svelte
<svelte:component this={activeRoute.component} />
```

Además, `tests/contract/app-composition.test.ts` bloquea una regresión futura y el comando E2E del lote usa `npm run test:browser -- tests/e2e/issuer-selection.spec.ts`, que ejecuta únicamente el archivo autoritativo.

## Causa secundaria del runner

r2 preservó correctamente `primaryFailure=test-e2e`, pero limpió `node_modules` antes de ejecutar `Validate-ControlPlaneEvidence.mjs`. El validador importa Ajv desde dependencias instaladas, por lo que terminó con `ERR_MODULE_NOT_FOUND: ajv`. No ocultó el fallo funcional, pero habría impedido un PASS aun si los tests hubieran pasado.

r3 copia temporalmente Ajv y sus dependencias exactas fuera del árbol antes de la limpieza, valida el JSON después de restaurar el árbol estable y elimina ese runtime temporal. También conserva errores secundarios, normaliza UTF-8, elimina `FORCE_COLOR` y copia capturas/contextos Playwright sin ZIPs anidados.

## Estado

T024–T030 continúan `IMPLEMENTED_PENDING_VALIDATION`; B06 continúa `LOCAL_VALIDATION_REQUIRED`; B07 permanece `PENDING`; `convergenceAuthorized=false`. El baseline completed sigue siendo `FS_v0.21.6_B05_completed.zip`.
## Validación disponible en el entorno de autoría

El plano de control de r3 pasó `994/994`. Se intentó `npm ci` en un intervalo acotado, pero no finalizó ni produjo un resultado ejecutable; se eliminó el `node_modules` parcial. No se declara PASS de npm, Playwright, regresión ni build desde el entorno de autoría. La evidencia obligatoria sigue siendo la producida por el runner r3 exacto en Windows.

