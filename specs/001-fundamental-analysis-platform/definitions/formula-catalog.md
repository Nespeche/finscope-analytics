# Catálogo normativo de fórmulas — v0.19.2

La autoridad ejecutable es `formula-catalog.json`. `decimal.js` v10+ y `ROUND_HALF_EVEN` son obligatorios.

## Precedencia normativa

| Orden | Clase | reasonCode | Regla |
|---:|---|---|---|
| 1 | `arity` | `invalid_arity` | validate declared minimum and maximum before inspecting values |
| 2 | `missing_input` | `required_input_missing` | a required position is absent or null |
| 3 | `invalid_input` | `invalid_input` | input is not a finite base-10 decimal string or violates the input kind |
| 4 | `non_canonical_input` | `non_canonical_decimal` | numeric text is parseable but violates DecimalString canonical form |
| 5 | `insufficient_data` | `insufficient_observations` | valid canonical data still cannot satisfy a formula-specific minimum observation rule |
| 6 | `zero_denominator` | `zero_denominator` | the effective denominator is exactly zero |
| 7 | `result_unavailable` | `non_finite_result` | the computed result is unavailable or non-finite after all prior checks |

Los inputs y outputs disponibles usan `DecimalString` canónico: cero=`0`; sin `-0`, exponentes ni ceros decimales finales. El reloj local, locale y timezone están prohibidos.

## Fórmulas

| formulaId | Aridad | Expresión |
|---|---|---|
| `identity` | 1..1 | `x` |
| `add` | 2..∞ | `Σ inputs` |
| `subtract` | 2..2 | `input[0] - input[1]` |
| `divide` | 2..2 | `input[0] / input[1]` |
| `ratio_change` | 2..2 | `(current / prior) - 1` |
| `divide_average_balance` | 3..3 | `numerator / ((opening + closing) / 2)` |
| `debt_bucket_sum` | 1..∞ | `Σ exact non-overlapping debt buckets` |
| `last` | 1..∞ | `series[n-1]` |
| `min` | 1..∞ | `min(series)` |
| `max` | 1..∞ | `max(series)` |
| `mean` | 1..∞ | `Σ series / n` |
| `median` | 1..∞ | `middle(sorted(series))` |
| `simple_return` | 2..∞ | `(last / first) - 1` |
| `max_drawdown` | 2..∞ | `min(price / runningMax - 1)` |
| `normalized_ols_ordinal` | 2..∞ | `OLS slope of y=price/firstPrice over x=0..n-1` |

## Orden ejecutable de argumentos v0.19.3

- `ratio_change` recibe exactamente `[current, prior]` y calcula `(current / prior) - 1`; el segundo argumento es el denominador.
- `normalized_ols_ordinal` transforma cada precio `pᵢ` en `yᵢ=pᵢ/firstPrice`, usa `xᵢ=i` para `i=0..n-1` y persiste la pendiente OLS de `y` contra `x`. No divide la pendiente por la media de precios ni por la media normalizada.
- Los resultados se redondean a escala 12 con `ROUND_HALF_EVEN` y luego se serializan con `decimal.js#toString()`.
