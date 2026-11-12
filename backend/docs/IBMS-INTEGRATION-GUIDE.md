# E-Invoice Hub — IBMS Integration Guide

> Based on **Evatra UAE E-Invoicing Data Dictionary** (`Evatra Data NEW FILE 13-AUG-2026.xlsx`).  
> IBMS sends **JSON** (not Excel). The Hub applies Excel rules and builds Peppol PINT-AE XML.

## Overview

```
IBMS  ──POST /v1/invoices──────────▶  Hub  ──▶  ASP  ──▶  Peppol + FTA
IBMS  ◀─GET  /v1/invoices/.../status─┘         │
IBMS  ──POST /v1/invoices/:id/asp-retry───────▶│──▶ /peppol/tdd/retry-failed
```

Status and retry for IBMS are **poll / request APIs only** (no Hub→IBMS webhooks).  
Hub itself **auto-polls ASP** in the background for in-progress invoices and updates Hub status.

---

## 1. Credentials (from Hub Admin)

| Key | Example | Where used |
|-----|---------|------------|
| `API_KEY` | `key_a1b2...` | Header `x-api-key` |
| `API_SECRET` | `secret_x9y8...` | HMAC `x-signature` |
| `tenantCode` | `CITY_MARINE` | Body (must match API key tenant) |
| `sourceSystem` | `IBMS_BROKING` | Body (must match integration code) |

Store in IBMS `.env` — never hardcode.

---

## 2. Base URL

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:3000/v1` |
| Production | `https://<hub-domain>/v1` |

---

## 3. Authentication

```
x-api-key: <API_KEY>
x-timestamp: <unix-ms>
x-signature: <HMAC-SHA256 of `${timestamp}.${body}`>
```

```javascript
const crypto = require('crypto');
const timestamp = Date.now().toString();
const body = JSON.stringify(payload);
const signature = crypto
  .createHmac('sha256', process.env.EINVOICE_API_SECRET)
  .update(`${timestamp}.${body}`)
  .digest('hex');
```

---

## 4. Document types (Excel Invoice Types)

| `documentType` | Excel name | UNCL code | Notes |
|----------------|------------|-----------|-------|
| `TAX_INVOICE` | Standard Tax Invoice | 380 | Default |
| `CREDIT_NOTE` | Standard Credit Note | 381 | Needs preceding invoice + reason |
| `DEBIT_NOTE` | Debit Note | 383 | Hub extension; needs preceding invoice |
| `SELF_BILLED_TAX_INVOICE` | Self-Billed Tax Invoice | 389 | ProfileExecutionID must be `00000000` |
| `SELF_BILLED_CREDIT_NOTE` | Self-Billed Credit Note | 261 | Preceding + reason; PEID `00000000` |
| `COMMERCIAL_INVOICE` | Commercial Invoice | 480 | Pure E or O lines (or send explicitly) |
| `COMMERCIAL_CREDIT_NOTE` | Commercial Credit Note | 81 | Preceding + reason |

**Auto-resolve:** If you send `TAX_INVOICE` / `CREDIT_NOTE` and **all** lines are `E` or **all** are `O`, Hub changes type to `COMMERCIAL_INVOICE` / `COMMERCIAL_CREDIT_NOTE`.

### Self-billing party roles

| Hub field | Peppol party | Who (CMIB self-bill) |
|-----------|--------------|----------------------|
| `seller` | AccountingSupplierParty | Invoice **issuer** (often the customer/CMIB) |
| `buyer` | AccountingCustomerParty | The **supplier** being billed |

---

## 5. Hub auto-fills (IBMS should NOT invent)

| Peppol | Hub value |
|--------|-----------|
| IBT-024 CustomizationID | billing or selfbilling URN |
| BT-23 ProfileID | billing or selfbilling URN |
| BTAE-02 ProfileExecutionID | from `transactionFlags` / `profileExecutionId`, else `00000000` |
| BT-3 Type code | from `documentType` |
| TaxScheme | `VAT` |
| BT-110…119 / BT-106…115 | Computed from lines |
| BT-126 Line ID | Sequential |
| BT-131 Line net | `qty × unitPrice` |
| Endpoint | First 10 digits of TRN if `endpointId` omitted |
| Defaults | `currencyCode=AED`, `unitCode=EA` |
| Line XML calc | BaseQuantity, ItemPriceExtension, line TaxTotal, price AC zeros |

---

## 6. Mandatory matrix — what IBMS must send

Aligned with Evatra **Invoice Types** (M = mandatory for that type).

| API field | Peppol | TI | CN | DN | SBI | SBCN | CI | CCN |
|-----------|--------|----|----|----|-----|------|----|-----|
| `tenantCode` / `sourceSystem` / `idempotencyKey` | — | Y | Y | Y | Y | Y | Y | Y |
| `documentType` | BT-3 | Y | Y | Y | Y | Y | Y | Y |
| `invoiceNumber` | BT-1 | Y | Y | Y | Y | Y | Y | Y |
| `issueDate` | BT-2 | Y | Y | Y | Y | Y | Y | Y |
| `dueDate` | BT-9 | Y* | Y* | Y* | Y* | Y* | Y* | Y* |
| `currencyCode` | BT-5 | Y | Y | Y | Y | Y | Y | Y |
| `seller.name` / `buyer.name` | BT-27 / BT-44 | Y | Y | Y | Y | Y | Y | Y |
| `seller.trn` | BT-29 | Y | Y | Y | Y | Y | Y | Y |
| `buyer.trn` | BT-46 | Y | Y | Y | Y | Y | — | — |
| `seller.address` + `buyer.address` (line1, city, state, countryCode) | BT-35…55 | Y | Y | Y | Y | Y | Y | Y |
| `seller/buyer.legalRegistration` + `schemeAgencyName` | BT-30/41 + **BTAE-12** | Y | Y | Y | Y | Y | Y | Y |
| `paymentMeans.code` (+ optional `name`) | IBT-081 / IBG-16 | Y | — | Y | Y | — | Y | — |
| `lines[]` qty / unitPrice / vatRate / vatCategory / description | BT-129/146/151/152/153 | Y | Y | Y | Y | Y | Y | Y |
| `precedingInvoiceRef` | BT-25 | — | Y | Y | — | Y | — | Y |
| `creditNoteReasonCode` | BTAE-03 | — | Y | — | — | Y | — | Y |
| `profileExecutionId` / flags | BTAE-02 | when used | same | same | force `00000000` | same | usually `00000000` | same |
| `principalTrn` | BTAE-14 | if agent billing | same | same | same | same | same | same |
| FX: `exchangeRate` + `taxInclusiveAmountInAed` | BTAE-04 / BTAE-20 | if not AED | same | same | same | same | same | same |
| AE: `rcmNatureCode` + exemption | **BTAE-09** | if AE | if AE | if AE | if AE | if AE | — | — |
| E/O/K/G: `vatExemptionReason` | IBT-120 | if used | if used | if used | if used | if used | if E/O | if E/O |

\*Hub requires `dueDate` whenever payable amount &gt; 0.

**TI** = TAX_INVOICE · **CN** = CREDIT_NOTE · **DN** = DEBIT_NOTE · **SBI/SBCN** = self-billed · **CI/CCN** = commercial

---

## 7. Create invoice

```
POST /v1/invoices
Content-Type: application/json
x-api-key: <API_KEY>
x-timestamp: ...
x-signature: ...
```

### Example — Tax Invoice (Excel-complete)

```json
{
  "tenantCode": "CITY_MARINE",
  "sourceSystem": "IBMS_BROKING",
  "idempotencyKey": "BROKING-COMM-100245",
  "documentType": "TAX_INVOICE",
  "invoiceNumber": "INV-100245",
  "sourceDocumentId": "100245",
  "issueDate": "2026-08-19",
  "dueDate": "2026-09-18",
  "currencyCode": "AED",
  "paymentMeans": {
    "code": "30",
    "name": "Credit transfer"
  },
  "seller": {
    "name": "City Marine Insurance LLC",
    "trn": "100123456700003",
    "address": {
      "line1": "Office 101, Business Bay Tower",
      "city": "Dubai",
      "state": "DXB",
      "countryCode": "AE"
    },
    "legalRegistration": {
      "tradeLicense": "1045678",
      "schemeAgencyName": "Department of Economic Development"
    }
  },
  "buyer": {
    "name": "ABC Trading LLC",
    "trn": "100987654300001",
    "address": {
      "line1": "Warehouse 5, Jebel Ali FZ",
      "city": "Dubai",
      "state": "DXB",
      "countryCode": "AE"
    },
    "legalRegistration": {
      "tradeLicense": "9988776",
      "schemeAgencyName": "Department of Economic Development"
    }
  },
  "lines": [
    {
      "description": "Broking Commission - Marine Cargo Policy POL-8891",
      "quantity": 1,
      "unitPrice": 5000,
      "vatRate": 5,
      "vatCategory": "S"
    }
  ],
  "notes": "Commission for marine cargo insurance"
}
```

### Example — Credit Note

```json
{
  "tenantCode": "CITY_MARINE",
  "sourceSystem": "IBMS_BROKING",
  "idempotencyKey": "CN-100245",
  "documentType": "CREDIT_NOTE",
  "invoiceNumber": "CN-100245",
  "sourceDocumentId": "CN-100245",
  "issueDate": "2026-08-20",
  "dueDate": "2026-08-20",
  "precedingInvoiceRef": {
    "id": "INV-100245",
    "issueDate": "2026-08-19"
  },
  "creditNoteReasonCode": "DL8.61.1.A",
  "seller": { "...same as tax invoice..." },
  "buyer": { "...same as tax invoice..." },
  "lines": [
    {
      "description": "Credit - Commission adjustment",
      "quantity": 1,
      "unitPrice": 500,
      "vatRate": 5,
      "vatCategory": "S"
    }
  ]
}
```

### Example — Self-Billed Tax Invoice

```json
{
  "documentType": "SELF_BILLED_TAX_INVOICE",
  "profileExecutionId": "00000000",
  "paymentMeans": { "code": "30", "name": "Credit transfer" },
  "seller": { "name": "City Marine Insurance LLC", "trn": "100123456700003", "...": "issuer" },
  "buyer": { "name": "Supplier Underwriter LLC", "trn": "100111122200003", "...": "supplier" },
  "lines": [ { "description": "Self-billed commission", "quantity": 1, "unitPrice": 2000, "vatRate": 5, "vatCategory": "S" } ]
}
```

### Example — Reverse charge (AE)

```json
{
  "lines": [
    {
      "description": "Imported service",
      "quantity": 1,
      "unitPrice": 1000,
      "vatRate": 5,
      "vatCategory": "AE",
      "vatExemptionReason": "Reverse charge — buyer accounts for VAT",
      "rcmNatureCode": "DL8.48.8.2"
    }
  ]
}
```

---

## 8. VAT categories (Excel Codes List)

| Code | Meaning | Extra required |
|------|---------|----------------|
| `S` | Standard 5% | `vatRate` 0 or 5 |
| `Z` | Zero-rated | `vatRate` 0 |
| `E` | Exempt | `vatExemptionReason` |
| `O` | Out of scope | `vatExemptionReason` |
| `AE` | Reverse charge | `vatExemptionReason` + `rcmNatureCode` |
| `K` / `G` | Intra-GCC / Export | `vatExemptionReason`, `vatRate` 0 |

---

## 9. Status tracking (poll API)

IBMS should **poll Hub** to refresh Status / ASP reference columns.

**Hub background sync:** every `ASP_STATUS_SYNC_INTERVAL_MS` (default 1 hour), Hub polls ASP for
invoices still in `SUBMITTED` / `ACCEPTED` / `FAILED` that have an ASP tracking id, and updates
Hub status when ASP has moved on. Disable with `ASP_STATUS_SYNC_ENABLED=false`.

On each IBMS status poll, when the invoice has an ASP tracking id and is still in progress
(`SUBMITTED` / `ACCEPTED` / `FAILED`), **Hub also polls that company ASP**,
updates the Hub invoice status if ASP has moved on, then returns the refreshed payload.
IBMS does **not** need a separate sync-status call.

### Track by Hub id (preferred)

```
GET /v1/invoices/status?hubInvoiceId=50
```

or

```
GET /v1/invoices/50/status
```

### Track by source keys

```
GET /v1/invoices/status?sourceDocumentId=100245
GET /v1/invoices/status?sourceSystemDCNoteId=119
```

Auth headers: same as create (`x-api-key`, `x-timestamp`, `x-signature`).  
For GET, sign empty JSON object: `HMAC-SHA256(`${timestamp}.{}`)`.

### Response (Swagger: `InvoiceStatusResponseDto`)

| Field | Use in IBMS |
|-------|-------------|
| `id` | Hub invoice column |
| `status` | Status column (`COMPLETED`/`ACCEPTED` → Posted, `FAILED`/`REJECTED` → Failed, else Processing) |
| `aspReferenceId` | ASP reference column |
| `rejectionReason` | Reject reason column |

### Retry — connect to source system (step by step)

IBMS must **never call ASP directly**. Retry is only:

`POST /v1/invoices/{hubInvoiceId}/asp-retry` → Hub → ASP `/peppol/tdd/retry-failed`

**Use Swagger tag `Invoices` (`/v1/invoices/...`), not `Admin - Invoices`.**

#### Step 1 — Hub credentials in IBMS `.env`

```env
EINVOICE_HUB_URL=http://localhost:3000/v1
EINVOICE_API_KEY=key_...
EINVOICE_API_SECRET=secret_...
EINVOICE_TENANT_CODE=CITY_MARINE
EINVOICE_SOURCE_SYSTEM=IBMS_BROKING
```

#### Step 2 — Save Hub invoice id on create

When IBMS posts `POST /v1/invoices`, store the response `id` (Hub numeric id) on the IBMS invoice / DC note row. That id is required for retry.

#### Step 3 — Show Retry only when ASP tracking exists

Enable the Retry button when Hub status poll shows a tracking / ASP reference id (and status is still retryable, e.g. `FAILED` / `SUBMITTED`). Without `trackingId`, ASP retry returns `400`. Hub then calls Evatra with ASP `companyId` + `invoiceId` (not `trackingId`).

#### Step 4 — Wire the Retry button to Hub

```typescript
async aspRetry(hubInvoiceId: number) {
  const timestamp = Date.now().toString();
  const body = '{}';
  const signature = crypto
    .createHmac('sha256', process.env.EINVOICE_API_SECRET!)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  const res = await fetch(
    `${process.env.EINVOICE_HUB_URL}/invoices/${hubInvoiceId}/asp-retry`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.EINVOICE_API_KEY!,
        'x-timestamp': timestamp,
        'x-signature': signature,
      },
      body,
    },
  );
  if (!res.ok) {
    throw new Error(`Hub asp-retry failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

// UI
onRetryClick(hubInvoiceId: number) {
  return this.aspRetry(hubInvoiceId);
}
```

#### Step 5 — Refresh status after retry

Call `GET /v1/invoices/status?hubInvoiceId={id}` (or `GET /v1/invoices/{id}/status`) and update IBMS Status / ASP reference columns from the response.

Statuses: `DRAFT` → `QUEUED` → `SUBMITTING` → `SUBMITTED` → `ACCEPTED` / `COMPLETED` / `REJECTED` / `FAILED`

---

## 10. IBMS NestJS `.env`

```env
EINVOICE_HUB_URL=http://localhost:3000/v1
EINVOICE_API_KEY=key_...
EINVOICE_API_SECRET=secret_...
EINVOICE_TENANT_CODE=CITY_MARINE
EINVOICE_SOURCE_SYSTEM=IBMS_BROKING
```

---

## 11. Checklist

- [ ] Credentials in `.env`
- [ ] Send Excel-complete party (TRN, address, legalRegistration + schemeAgencyName)
- [ ] Set correct `documentType` (tax / credit / self-bill / commercial)
- [ ] Credit family: `precedingInvoiceRef` + `creditNoteReasonCode`
- [ ] Invoice family: `paymentMeans` + `dueDate`
- [ ] Self-bill: `profileExecutionId` = `00000000` and correct seller/buyer roles
- [ ] AE lines: `rcmNatureCode`
- [ ] Save Hub `id` and poll `GET /v1/invoices/status?hubInvoiceId=…` (or `GET /v1/invoices/:id/status`) — Hub pulls ASP status and updates itself, then returns Status / ASP reference
- [ ] Retry button → `POST /v1/invoices/:id/asp-retry` (Swagger **Invoices**, not Admin; needs ASP trackingId)

---

## Support

- Swagger: `http://localhost:3000/docs`
  - **Invoices** — IBMS / source systems (`x-api-key` + HMAC)
  - **Admin - Invoices** — Hub dashboard only (`x-admin-key`)
- Admin Dashboard: `http://localhost:5173`
- Spec source: Evatra Data Dictionary Excel (Invoice Types / Codes / Calculation Layers)

IBMS status is poll-only (no Hub→IBMS webhooks). Hub auto-syncs from ASP in the background.
Do not configure source-system webhook callbacks for this hub.
