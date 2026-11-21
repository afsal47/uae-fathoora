# Multi-tenant / Multi-ASP architecture

```text
IBMS / ASIB / Other ERP
          |
          v
   Common Hub API (/v1/invoices)
          |
          v
 Tenant via Integration API key
          |
          v
 Legal Entity
   (payload legalEntityCode → integration link → tenant default)
          |
          v
 Common validation + PINT AE XML
          |
          v
 AspConnectionResolver (ACTIVE SENDING connection required)
          |
          v
 AspProviderResolver (by provider code on connection)
     +-----------+------------+
     |                        |
     v                        v
 EvatraAdapter           MockAspBAdapter (scaffold)
     |                        |
     v                        v
  EVATRA API              test fixture only
```

## Professional setup order (admin)

1. **Tenant** — company account only (`CITY_MARINE`). No ASP credentials here.
2. **Legal entities** — one per TRN/company (`CM_DXB`, `CM_IND`). Mark one default if needed.
3. **ASP Providers** — master + API config (SANDBOX/PRODUCTION). Ready only if adapter is implemented **and** status is ACTIVE.
4. **ASP Connections** — per legal entity: provider, environment, encrypted API key/email, activate one SENDING connection.
5. **Integrations** — source system (`IBMS_DXB`) linked to the correct legal entity; copy API key/secret to the ERP.

### Multi-company from one ERP (e.g. IBMS Dubai + India)

Preferred options:

- **A (simple):** two integrations (`IBMS_DXB`, `IBMS_IND`), each linked to its legal entity.
- **B (one integration):** send optional `legalEntityCode` on each invoice (`CM_DXB` / `CM_IND`). Integration default is used when omitted.

Invoice create **fails** if the resolved legal entity has no ACTIVE SENDING ASP connection. Legacy `tenant.asp*` submit is disabled unless `ENABLE_LEGACY_TENANT_ASP=true`.

## Database relationships

```text
Tenant 1--* LegalEntity 1--* AspConnection *--1 AspProvider
                                  |
                                  +--* AspCredential (encrypted)
AspProvider 1--* AspProviderApiConfig (SANDBOX / PRODUCTION docs)
Invoice *--? LegalEntity
Invoice *--? AspConnection
```

## Business rules

- At most one **ACTIVE SENDING** `AspConnection` per `(legalEntityId, environment)`.
- Provider master activation ≠ adapter implementation.
- Credentials never returned by admin APIs.
- Queue jobs carry `tenantId` / `legalEntityId` / `aspConnectionId` and are revalidated before submit.
- Legal entity resolution order: `legalEntityCode` → integration.legalEntityId → tenant default.
