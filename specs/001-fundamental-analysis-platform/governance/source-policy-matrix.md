# Source policy matrix — revisión normativa v0.19.3 / paquete v0.20

<a id="active-source-policy"></a>
## Active source policy

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

| Source/profile | Status | Purpose | Priority | Restrictions |
|---|---|---|---:|---|
| SEC Submissions | ACTIVE | filing/identity metadata | 10 | cache, fair-access, max 1 call/operation |
| SEC Company Facts | ACTIVE_PRIMARY | fundamental facts | 20 | primary facts source, max 1 call/operation |
| SEC Company Concept | ACTIVE_SELECTIVE_FALLBACK | unresolved exact concept | 30 | only allowlisted exact mappings, max 12 calls |
| local_csv_manual_v1 | ACTIVE_OPTIONAL | historical price overlay | 40 | local import; descriptive only |
| twelve_data_provider_v1 | DEFERRED_POST_MVP | future price provider | — | no calls/credentials |
| alpha_vantage_provider_v1 | DEFERRED_POST_MVP | future price provider | — | no calls/credentials |

No fuente de precio interviene en fundamentals. No se habilita una fuente por fallback implícito.
