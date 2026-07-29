# Registro de perfiles de fuente de mercado — revisión normativa v0.19.3 / paquete v0.20

<a id="profile-register"></a>
## Profile register

> **Authority references:** see `governance/authority-crosswalk.json` for the exact primary authority and reverse consumers.

| profileId | Estado | Ingesta | Uso permitido |
|---|---|---|---|
| `local_csv_manual_v1` | ACTIVE | CSV/entrada manual con confirmación | ocho métricas históricas descriptivas |
| `twelve_data_provider_v1` | DEFERRED_POST_MVP | ninguna | ninguno |
| `alpha_vantage_provider_v1` | DEFERRED_POST_MVP | ninguna | ninguno |

Los IDs con `_v1` son canónicos en todos los contratos. Perfiles diferidos no son alcanzables desde UI/OpenAPI.
