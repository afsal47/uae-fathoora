/**
 * Local ClearTax Sandbox Simulator
 *
 * Run separately: npx ts-node src/asp/sandbox-simulator.ts
 * Simulates ClearTax API on port 3100.
 *
 * Accepts UBL 2.1 XML (PINT-AE) invoices, validates required elements,
 * returns realistic responses, and sends webhook callbacks to the Hub.
 */
import http from 'http';
import { randomUUID } from 'crypto';

const PORT = 3100;
const HUB_WEBHOOK_URL = 'http://localhost:3000/v1/asp/webhooks/CLEARTAX';

function parseBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function respond(res: http.ServerResponse, status: number, body: Record<string, unknown>) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, null, 2));
}

function extractXmlValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<(?:cbc:)?${tag}[^>]*>([^<]*)</(?:cbc:)?${tag}>`);
  const match = xml.match(regex);
  return match?.[1]?.trim() ?? null;
}

function xmlContains(xml: string, tag: string): boolean {
  return new RegExp(`<(?:cac:|cbc:)?${tag}[\\s>]`).test(xml);
}

function validatePintAeXml(xml: string): string[] {
  const errors: string[] = [];

  if (!xml.includes('urn:oasis:names:specification:ubl:schema:xsd:')) {
    errors.push('Missing UBL 2.1 namespace declaration');
  }

  const hasBillingProfile =
    xml.includes('urn:peppol:pint:billing-1@ae-1') ||
    xml.includes('urn:peppol:pint:billing-1@uae-1') ||
    xml.includes('urn:peppol:pint:selfbilling-1@ae-1');
  if (!hasBillingProfile) {
    errors.push(
      'Missing PINT-AE CustomizationID (urn:peppol:pint:billing-1@ae-1 or selfbilling-1@ae-1)',
    );
  }

  if (!extractXmlValue(xml, 'ID')) {
    errors.push('Invoice ID (number) is required');
  }

  if (!extractXmlValue(xml, 'IssueDate')) {
    errors.push('IssueDate is required');
  }

  const typeCode =
    extractXmlValue(xml, 'InvoiceTypeCode') ??
    extractXmlValue(xml, 'CreditNoteTypeCode');
  const allowedTypeCodes = ['380', '381', '383', '389', '261', '480', '81'];
  if (!typeCode) {
    errors.push('InvoiceTypeCode or CreditNoteTypeCode is required');
  } else if (!allowedTypeCodes.includes(typeCode)) {
    errors.push(
      `Invalid type code: ${typeCode}. Expected one of ${allowedTypeCodes.join(', ')}`,
    );
  }

  if (!extractXmlValue(xml, 'DocumentCurrencyCode')) {
    errors.push('DocumentCurrencyCode is required');
  }

  if (!xmlContains(xml, 'AccountingSupplierParty')) {
    errors.push('AccountingSupplierParty (seller) is required');
  } else {
    if (!xmlContains(xml, 'PartyName')) {
      errors.push('Seller PartyName is required');
    }
    const supplierSection = xml.match(
      /<cac:AccountingSupplierParty>([\s\S]*?)<\/cac:AccountingSupplierParty>/,
    );
    if (supplierSection && !supplierSection[1].includes('CompanyID')) {
      errors.push('Seller TRN (CompanyID) is required for UAE tax invoices');
    }
  }

  if (!xmlContains(xml, 'AccountingCustomerParty')) {
    errors.push('AccountingCustomerParty (buyer) is required');
  }

  if (!xmlContains(xml, 'InvoiceLine') && !xmlContains(xml, 'CreditNoteLine')) {
    errors.push('At least one InvoiceLine is required');
  }

  if (!xmlContains(xml, 'TaxTotal')) {
    errors.push('TaxTotal is required');
  }

  if (!xmlContains(xml, 'LegalMonetaryTotal')) {
    errors.push('LegalMonetaryTotal is required');
  }

  if (!xmlContains(xml, 'PayableAmount')) {
    errors.push('PayableAmount is required');
  }

  if (!xmlContains(xml, 'ProfileID')) {
    errors.push('ProfileID is required (urn:peppol:bis:billing)');
  }

  if (!xmlContains(xml, 'PartyTaxScheme')) {
    errors.push('PartyTaxScheme is required for seller');
  }

  if (!xmlContains(xml, 'PartyLegalEntity')) {
    errors.push('PartyLegalEntity / RegistrationName is required');
  }

  const vatCategories = xml.match(/<cbc:ID>([A-Z]{1,2})<\/cbc:ID>/g) ?? [];
  const exemptCats = ['E', 'AE', 'O', 'K', 'G'];
  for (const match of vatCategories) {
    const cat = match.replace(/<\/?cbc:ID>/g, '');
    if (exemptCats.includes(cat) && !xml.includes('TaxExemptionReason')) {
      errors.push(`VAT category ${cat} requires TaxExemptionReason`);
      break;
    }
  }

  const typeCodeVal =
    extractXmlValue(xml, 'InvoiceTypeCode') ??
    extractXmlValue(xml, 'CreditNoteTypeCode');
  if (typeCodeVal === '381' || typeCodeVal === '383') {
    if (!xmlContains(xml, 'BillingReference')) {
      errors.push('Credit/Debit notes require BillingReference (preceding invoice)');
    }
  }

  return errors;
}

const server = http.createServer(async (req, res) => {
  console.log(`[Sandbox] ${req.method} ${req.url}`);

  if (req.method === 'POST' && req.url === '/api/v1/invoices') {
    try {
      const body = await parseBody(req);
      const tenantCode = req.headers['x-tenant-id'] as string;
      const authToken = req.headers['x-cleartax-auth-token'] as string;
      const contentType = req.headers['content-type'] ?? '';

      if (!authToken) {
        return respond(res, 401, { message: 'Missing x-cleartax-auth-token header' });
      }

      const isXml =
        contentType.includes('xml') || body.trimStart().startsWith('<?xml');

      if (!isXml) {
        console.log(`[Sandbox] WARNING: Received non-XML payload (Content-Type: ${contentType})`);
        console.log(`[Sandbox] PINT-AE requires UBL 2.1 XML. Rejecting JSON payloads.`);
        return respond(res, 415, {
          message:
            'Unsupported Media Type. PINT-AE invoices must be submitted as UBL 2.1 XML (Content-Type: application/xml)',
        });
      }

      const validationErrors = validatePintAeXml(body);
      const invoiceId = extractXmlValue(body, 'ID') ?? randomUUID();
      const uuid = `ct_${randomUUID()}`;
      const referenceId = `ref_${invoiceId}`;

      if (validationErrors.length > 0) {
        console.log(`[Sandbox] REJECTED — ${validationErrors.length} validation errors`);
        return respond(res, 422, {
          uuid,
          referenceId,
          status: 'REJECTED',
          message: 'PINT-AE UBL 2.1 XML validation failed',
          rejectionReason: validationErrors.join('; '),
          validationErrors,
        });
      }

      console.log(`[Sandbox] SUBMITTED — ${invoiceId} (UBL 2.1 XML)`);
      respond(res, 200, {
        uuid,
        referenceId,
        status: 'SUBMITTED',
        message: `Invoice ${invoiceId} accepted for processing (UBL 2.1 XML)`,
        acknowledgedAt: new Date().toISOString(),
      });

      setTimeout(async () => {
        console.log(`[Sandbox] Sending ACCEPTED webhook for ${invoiceId}`);
        try {
          await fetch(HUB_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantCode,
              uuid,
              referenceId,
              invoiceNumber: invoiceId,
              status: 'ACCEPTED',
              message: `Invoice ${invoiceId} accepted by ClearTax sandbox (UBL 2.1)`,
            }),
          });
          console.log(`[Sandbox] Webhook sent successfully`);
        } catch (err) {
          console.error(`[Sandbox] Webhook failed:`, err);
        }
      }, 3000);
    } catch {
      respond(res, 400, { message: 'Invalid request body' });
    }
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    return respond(res, 200, { status: 'ok', service: 'cleartax-sandbox', format: 'UBL 2.1 XML (PINT-AE)' });
  }

  respond(res, 404, { message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\n  ClearTax Sandbox Simulator running on http://localhost:${PORT}`);
  console.log(`  Accepts: UBL 2.1 XML (PINT-AE) invoices`);
  console.log(`  POST /api/v1/invoices  — Submit XML invoice`);
  console.log(`  GET  /health           — Health check`);
  console.log(`  Webhook target: ${HUB_WEBHOOK_URL}\n`);
});
