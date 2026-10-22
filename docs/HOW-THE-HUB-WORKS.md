# How UAE-FATHOORA works

This note is for developers joining the project. It explains who talks to whom, what the admin screens mean, and where the code lives. Field-level invoice JSON is in [IBMS-INTEGRATION-GUIDE.md](../backend/docs/IBMS-INTEGRATION-GUIDE.md).

## What this system is

UAE-FATHOORA is a multi-tenant e-invoicing hub. A source system (for example IBMS) sends an invoice as JSON. The hub stores it, builds Peppol PINT-AE XML, and posts that XML to the tenant’s Access Point (ASP). The ASP is the service that delivers the invoice onward (Peppol / FTA). The hub then tells the source system the result by webhook.

```
Source system                Hub                         Access Point
(IBMS, POS, …)               (this repo)                 (tenant’s ASP)

POST /v1/invoices  ───────▶  save invoice
  JSON                         assign inv-N
  x-api-key                    build PINT-AE XML
                               POST JSON ───────────────▶  aspBaseUrl
                               (XML as base64Document)
                               ◀──────── status
webhook ◀────────────────────  invoice.accepted / rejected / failed
```

There are two apps in this repo:

| Folder | What it is | Default URL |
|--------|------------|-------------|
| `backend` | NestJS API | `http://localhost:3004` (prefix `/v1`, Swagger at `/docs`) |
| `frontend` | React admin dashboard | Vite dev server. It calls the API using `VITE_API_URL`. |

Production API used by source systems: `https://api.uaefathoora.ikeypos.com/v1`.

## The three names people mix up

These are different records. Getting them wrong is the usual reason a source system gets 403 or “integration not found”.

| Name | Where you see it | What it is |
|------|------------------|------------|
| Tenant code | Tenants page, and the dropdown on Integrations (`SAMPLE — test`) | The company on the hub. `SAMPLE` is the code. `test` is only the display name. |
| Integration code | Integrations table, column **Code** (`SSAAMMPPLE`) | The source system’s login on that tenant. The invoice body field `sourceSystem` must match this code. |
| Integration name | Integrations table, column **Name** (`SampleData`) | A label for humans. The API does not use it. |

One tenant can have several integrations (one per source system). The API key belongs to one integration, so it also belongs to one tenant.

When the source system posts an invoice:

- `tenantCode` must be the tenant code (`SAMPLE`).
- `sourceSystem` must be the integration code (`SSAAMMPPLE`).
- Header `x-api-key` must be that integration’s key.

The hub rejects the call if `sourceSystem` does not match the integration that owns the API key.

## What the admin dashboard does

Sign-in uses the hub admin key (`ADMIN_API_KEY` in `backend/.env`). The browser stores it and sends it as `x-admin-key`. This key is only for the dashboard. Source systems never use it.

| Page | Route | What you do there |
|------|-------|-------------------|
| Dashboard | `/` | Counts and recent invoices |
| Tenants | `/tenants` | Register a company and its ASP (`aspProvider`, `aspBaseUrl`, ASP API key, webhook token) |
| Integrations | `/integrations` | Pick a tenant, then create the source-system client (code, name, webhook URL). The hub shows the API key and secret once. |
| Invoices | `/invoices` | Read status, amounts, and submission detail. Invoices are created by the API, not by this page. |

The hub URL is **not** stored on the integration. Each source system keeps it in its own environment.

## How a source system is configured

On the source system (not in this repo), set:

```env
EINVOICE_HUB_URL=https://api.uaefathoora.ikeypos.com/v1
EINVOICE_API_KEY=key_...
EINVOICE_API_SECRET=secret_...
EINVOICE_TENANT_CODE=SAMPLE
EINVOICE_SOURCE_SYSTEM=SSAAMMPPLE
```

`EINVOICE_HUB_URL` must end with `/v1`. The create call is `POST {EINVOICE_HUB_URL}/invoices`.

For a hub running on your machine, use `http://localhost:3004/v1`. Restart the source system after changing this file.

The API key and secret are created on the Integrations page (**Regen Keys** replaces them). Copy them into the source system `.env`. Do not commit them.

Optional: set the integration **Webhook URL** so the hub can POST status events back (`invoice.submitted`, `invoice.accepted`, `invoice.rejected`, `invoice.failed`, `invoice.cancelled`).

## What happens when an invoice is posted

1. `InvoicesController` checks `x-api-key` and that `sourceSystem` matches that integration.
2. `InvoicesService` loads the tenant by `tenantCode` and the integration by `sourceSystem`.
3. The same `idempotencyKey` returns the existing invoice instead of creating a second one.
4. Line `unitPrice` from the source system is **tax-inclusive**. The hub stores the Peppol net unit price. Example: `105` at 5% VAT becomes net `100`, tax `5`, total `105`.
5. The source document number (`sourceSystemDCNoteId`, or the older `sourceSystemCreditNoteId` / `invoiceNumber`) is saved as the IBMS DC note. It is not the Peppol id.
6. The hub assigns the next Peppol number for that tenant: `inv-1`, `inv-2`, and so on (`tenants.invoiceSequence`).
7. The invoice is saved as `QUEUED` and a job is added.
8. The worker builds PINT-AE XML. `GenericAspAdapter` logs in at `{origin}/auth/login` with the tenant ASP API key and tenant email, then POSTs the document to `aspBaseUrl`. The header is `R-Auth` with the returned JWT. The XML is Base64 in `base64Document`, and the same API key is the body field `apiKey`.
9. Status moves through `QUEUED` → `SUBMITTING` → `SUBMITTED` → `ACCEPTED` or `REJECTED`. A transport or ASP error becomes `FAILED`. `POST /v1/invoices/:id/requeue` retries a failed invoice.
10. If the integration has a webhook URL, the hub queues a callback to the source system.

ASP replies can also arrive at `POST /v1/asp/webhooks/:provider`.

## Invoice numbers

| Field | Who sets it | Example | Meaning |
|-------|-------------|---------|---------|
| `invoiceNumber` | Hub | `inv-12` | Peppol document id (`cbc:ID`) |
| `sourceSystemDCNoteId` | Source system | `119` | IBMS DC note / source document number |
| `id` | Database | `42` | Numeric primary key. Use this in hub URLs. |

## Queue

Invoice submission and outbound webhooks run through BullMQ when Redis is configured.

| `QUEUE_MODE` | Behaviour |
|--------------|-----------|
| `bullmq` | Jobs go to Redis. Redis must be running at `REDIS_HOST` / `REDIS_PORT` (default `127.0.0.1:6379`). |
| `inline` | Jobs run inside the API process. Use this on a machine with no Redis. A restart drops work that has not finished. |
| unset, and no Redis host | Same as `inline`. |

`ECONNREFUSED 127.0.0.1:6379` means the API is in BullMQ mode and Redis is not running. Start Redis, or set `QUEUE_MODE=inline` and restart the API.

Job ids use a hyphen (`invoice-12`), not a colon. Redis rejects custom ids that contain `:`.

## Hub environment

Copy these into `backend/.env`. Do not commit real values.

| Variable | Purpose |
|----------|---------|
| `PORT` | API port. Local default is `3004`. |
| `DATABASE_URL` | SQL Server connection string (database `UAE_FATHOORA`). |
| `ADMIN_API_KEY` | Dashboard login. Sent as `x-admin-key`. |
| `HMAC_REQUIRED` | `false` skips `x-signature` / `x-timestamp`. Set `true` when the source system signs requests. |
| `SECRETS_MASTER_KEY` | Encrypts ASP keys and integration secrets in the database. Every server that uses this database must use the same key. |
| `QUEUE_MODE` | `bullmq` or `inline`. |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_URL` | Redis for BullMQ. |
| `CORS_ORIGINS` | Comma-separated browser origins. Empty allows all. |

Frontend `frontend/.env`:

```env
VITE_API_URL=http://localhost:3004
```

Production:

```env
VITE_API_URL=https://api.uaefathoora.ikeypos.com
```

The frontend adds `/v1` if you omit it. Restart Vite after changing this file.

## Run it locally

```bash
# API
cd backend
npm install
npx prisma generate --schema prisma/schema.prisma
npm run start:dev

# Admin UI (second terminal)
cd frontend
npm install
npm run dev
```

Prisma models all live in `backend/prisma/schema.prisma`. On a Linux server, generate the client there (`binaryTargets` includes Debian OpenSSL 3). Do not copy a Windows-generated Prisma client onto the VPS.

If `npm run start:dev` crashes with `Cannot find module './app.controller'`, stop every watch process, delete `backend/dist`, and start one watch again. Two watches deleting `dist` at the same time leave a half-written build.

## Where to change things

| You want to… | Look here |
|--------------|-----------|
| Accept a new invoice field | `backend/src/invoices/dto/create-invoice.dto.ts` |
| Save or price an invoice | `backend/src/invoices/invoices.service.ts` |
| Peppol XML / payload | `backend/src/asp/pint-ae-xml.builder.ts`, `pint-ae-payload.builder.ts` |
| How XML is posted to the ASP | `backend/src/asp/generic-asp.adapter.ts` |
| API key check | `backend/src/auth/api-key.guard.ts` |
| Admin key check | `backend/src/auth/admin-auth.guard.ts` |
| Queue | `backend/src/queue/queue.service.ts` |
| Status callback to the source system | `backend/src/webhooks/outbound-webhook.service.ts` |
| Admin screens | `frontend/src/pages/` |
| Source-system payload examples | `backend/docs/IBMS-INTEGRATION-GUIDE.md` |

Every tenant uses `GenericAspAdapter`. The provider name on the tenant (`aspProvider`) is a label. The URL that receives the JSON envelope is `aspBaseUrl`. The Peppol XML is inside `base64Document`.
