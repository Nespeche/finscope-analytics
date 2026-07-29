# Catálogo de mappings XBRL — v0.19.2

**Autoridad ejecutable:** `xbrl-mapping-catalog.json`

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

Cada mapping materializa ID, versión, taxonomy, tag exacto, concepto canónico, perfiles, period/unit/scope/sign policy, quality, precedencia, status y evidencia. `inferenceAllowed=false` en todos los mappings activos. La resolución ordena por precedencia e ID; extensiones/tags no listados permanecen no resueltos.

La deuda usa buckets aprobados no solapados; un total genérico queda deshabilitado salvo mapping futuro exacto que excluya leases y documente precedencia.
