# Decisión normativa decimal — revisión normativa v0.19.3 / paquete v0.20

**Estado:** ACTIVE_AUTHORITY  
**Versión:** 1.0.0  
**Fecha:** 2026-07-21  
**Remediación:** NF-003 v0.18; consistencia retenida en v0.19  
**Dominio de autoridad:** `decimal_arithmetic` (AUTH-026)

---

## Decisión

La librería elegida para toda aritmética financiera decimal en el cliente (browser/Web Worker) es **`decimal.js`** v10+, licencia MIT.

```
npm: decimal.js
Versión mínima: 10.4.0
Licencia: MIT (compatible con distribución libre)
Tamaño bundle: ~32 KB minificado, ~12 KB gzip
```

---

## Requisitos que resuelve

La especificación mandaba (FR-008, metric-catalog.json `roundingDefault`):

- **Escala:** hasta 12 posiciones decimales para políticas `scale=12`
- **Modo de redondeo:** `ROUND_HALF_EVEN` (redondeo bancario, IEEE 754-2019 roundTiesToEven)
- **Tipo de almacenamiento:** `DecimalString` (JSON string, nunca `number` IEEE-754)
- **Prohibición:** ningún cálculo de métrica usa aritmética de punto flotante nativa

`decimal.js` satisface estos requisitos nativamente:

```js
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });
const result = new Decimal(a).plus(b).toDecimalPlaces(12, Decimal.ROUND_HALF_EVEN);
const stored = result.toString(); // DecimalString para JSON — sin trailing zeros (requerido por schema)
```

> **Nota:** `.toFixed(12)` produce trailing zeros (ej. `"0.300000000000"`) que el regex de `common.schema.json#DecimalString` rechaza. El método correcto es `.toDecimalPlaces(12).toString()` que produce `"0.3"`. Los fixtures en `metric-test-vectors.json` confirman el formato sin trailing zeros.

---

## Alternativas descartadas

| Alternativa | Razón de descarte |
|-------------|------------------|
| `big.js` | Solo 3 modos de redondeo; ROUND_HALF_EVEN no disponible nativamente |
| `bignumber.js` | Mismo autor que decimal.js pero API más verbosa; sin ventaja funcional para este caso |
| `mathjs` | Bundle ~150 KB; overkill para operaciones financieras simples |
| `Intl.NumberFormat` | Solo formateo, no aritmética |
| `Number` nativo | IEEE-754 double: error acumulado en sumas de muchos términos, inaceptable para datos financieros |

---

## Reglas de uso

1. **Todo cálculo de métrica** usa `Decimal`, nunca `Number` para el resultado.
2. Los hechos XBRL llegan como `string` del JSON y se convierten con `new Decimal(factString)`.
3. El resultado final de cada métrica se almacena como `DecimalString` (`.toDecimalPlaces(scale, Decimal.ROUND_HALF_EVEN).toString()` donde `scale` viene de `roundingPolicy` del catálogo). No usar `.toFixed(scale)` — produce trailing zeros que el schema rechaza.
4. Los fingerprints usan el `DecimalString` almacenado, nunca el objeto `Decimal`.
5. La UI puede convertir a `Number` solo para presentación; esa conversión no se almacena ni se fingerprintea.

---

## Relación con test vectors

Los `fixtures/metrics/metric-test-vectors.json` definen los resultados esperados como `DecimalString`. Cualquier cambio de librería o configuración que altere esos strings es un fallo de regresión.

---

## Consumers

- `specs/001-fundamental-analysis-platform/spec.md` (FR-008, FR-014)
- `specs/001-fundamental-analysis-platform/definitions/metric-catalog.json` (roundingPolicy, roundingDefault)
- `specs/001-fundamental-analysis-platform/fixtures/metrics/metric-test-vectors.json`
- `specs/001-fundamental-analysis-platform/schemas/common.schema.json` (DecimalString type)


## Precedencia de evaluación v0.19.2

1. aridad (`invalid_arity`);
2. input ausente (`required_input_missing`);
3. input inválido (`invalid_input`);
4. decimal no canónico (`non_canonical_decimal`);
5. datos insuficientes (`insufficient_observations`);
6. denominador cero (`zero_denominator`);
7. resultado no disponible/no finito (`non_finite_result`).

Se devuelve solo el primer `reasonCode` aplicable. Los 36 vectores usan inputs/outputs canónicos, `ols-insufficient` devuelve `invalid_arity`, y ninguna fórmula consulta reloj local, locale o timezone.
