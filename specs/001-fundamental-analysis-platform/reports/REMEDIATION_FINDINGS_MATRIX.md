# Matriz de remediación v0.8

| Hallazgo | Decisión aplicada | Documentos modificados/creados | Estado |
|---|---|---|---|
| `H-B01` | Matriz de políticas; proveedores bloqueados por defecto | source-policy-matrix.md; spec; research; adapter; OpenAPI | `resolved` |
| `H-B02` | Catálogo normativo cerrado con fórmulas y tolerancias | metric-catalog.md; spec; pipeline; model | `resolved` |
| `H-B03` | Catálogo de reglas y fórmula 35/25/20/20 | insight-rule-catalog.md; spec; pipeline; model | `resolved` |
| `H-B04` | Cinco coberturas y enums canónicos | state-and-capability-matrix.md; spec; model; OpenAPI; storage | `resolved` |
| `H-B05` | Búsqueda externa retirada del MVP | spec; adapter; OpenAPI | `resolved` |
| `H-B06` | Credential POST body writeOnly only | spec; adapter; OpenAPI; plan | `resolved` |
| `H-B07` | Manual obligatorio/opcional y capabilities | spec; model; state matrix; adapter | `resolved` |
| `H-B08` | Contrato canónico alineado y OpenAPI estricto | model; OpenAPI; adapter | `resolved` |
| `H-B09` | Identidad/listings/ADR/CEDEAR delimitados | spec; model; pipeline | `resolved` |
| `H-B10` | No inferir corporate actions; bloqueos definidos | spec; metric catalog; pipeline; OpenAPI | `resolved` |
| `H-B11` | Frescura y tolerancias temporales cerradas | spec; storage; pipeline; state matrix | `resolved` |
| `H-B12` | Perfil, p95, cancelación y 1e-6 definidos | spec; quickstart; pipeline | `resolved` |
| `H-B13` | Mapping US-GAAP y matriz sectorial | xbrl-mapping-catalog.md; spec; pipeline | `resolved` |
| `H-B14` | Hono, Zod, SVG y tabla cerrados | plan; spec; research | `resolved` |
| `H-I01` | Revisión 90 días, expiración y kill switch | source-policy-matrix.md | `resolved` |
| `H-I02` | Presupuesto por flujo y topes internos | spec; plan; research | `resolved` |
| `H-I03` | CSV encoding, límites, atomicidad e injection | spec; adapter; quickstart | `resolved` |
| `H-I04` | SEC 2/8 MiB, streaming, timeout y fallback | spec; plan; OpenAPI | `resolved` |
| `H-I05` | StatisticalTrace completo | metric catalog; model; spec | `resolved` |
| `H-I06` | Matriz estado-capacidad-recuperación | state-and-capability-matrix.md | `resolved` |
| `H-I07` | Ventana inclusiva XOR outputSize; max 500 | spec; adapter; OpenAPI | `resolved` |
| `H-I08` | Cancelación end-to-end idempotente | spec; pipeline; adapter | `resolved` |
| `H-I09` | SVG/table y nomenclatura cerrada | plan; glossary; spec | `resolved` |
| `H-I10` | Consentimiento, cuota, migración y borrado | browser-storage.md; spec | `resolved` |
| `H-I11` | HTTP same-origin, CSP, caps, timeout | spec; plan; adapter; OpenAPI | `resolved` |
| `H-I12` | Administración remota retirada del MVP | spec; plan; OpenAPI | `resolved` |
| `H-M01` | Nombres lógicos sin sufijo físico | START_HERE; reports; manifest | `resolved` |
| `H-M02` | Dividend yield fuera del MVP | spec; metric catalog; pipeline | `resolved` |
| `H-M03` | Glosario y etiquetas canónicas | GLOSSARY.md; spec; plan | `resolved` |

Los estados reflejan corrección documental. No sustituyen la nueva ejecución de checklist ni marcan los ítems históricos como aprobados.
