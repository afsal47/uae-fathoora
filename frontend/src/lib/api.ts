import axios from 'axios';

const ADMIN_KEY_STORAGE = 'eih_admin_key';

export function getAdminKey(): string | null {
  return localStorage.getItem(ADMIN_KEY_STORAGE);
}

export function setAdminKey(key: string) {
  localStorage.setItem(ADMIN_KEY_STORAGE, key);
}

export function clearAdminKey() {
  localStorage.removeItem(ADMIN_KEY_STORAGE);
}

const api = axios.create({ baseURL: '/v1' });

api.interceptors.request.use((config) => {
  const key = getAdminKey();
  if (key) {
    config.headers['x-admin-key'] = key;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      clearAdminKey();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export type Tenant = {
  id: string;
  code: string;
  name: string;
  trn: string | null;
  email: string | null;
  phone: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  countryCode: string;
  aspProvider: string;
  aspBaseUrl: string | null;
  aspApiKey: string | null;
  aspWebhookToken: string | null;
  isActive: boolean;
  createdAt: string;
  integrations: Integration[];
  _count?: { invoices: number };
};

export type Integration = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  authType: string;
  apiKey: string;
  apiSecret: string;
  webhookUrl: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { invoices: number };
};

export type InvoiceEvent = {
  id: string;
  type: string;
  fromStatus: string | null;
  toStatus: string | null;
  message: string;
  createdAt: string;
};

export type InvoiceLine = {
  id: string;
  lineNumber: number;
  description: string;
  quantity: string;
  unitPrice: string;
  netAmount: string;
  vatRate: string;
  vatCategory: string;
  taxAmount: string;
  totalAmount: string;
};

/** Extra fields from the source-system create payload (stored as ASP passthrough). */
export type InvoiceSourcePayload = {
  taxPointDate?: string;
  dueDate?: string;
  taxCurrencyCode?: string;
  accountingCost?: string;
  contractReference?: string;
  paymentMeans?: Record<string, unknown>;
  paymentTerms?: Record<string, unknown>;
  delivery?: Record<string, unknown>;
  invoicePeriod?: Record<string, unknown>;
  precedingInvoiceRef?: { id?: string; issueDate?: string; [key: string]: unknown };
  againstDCNoteId?: string;
  againstCreditNoteId?: string;
  creditNoteReasonCode?: string;
  reasonCode?: string;
  orderReference?: Record<string, unknown>;
  allowanceCharges?: Record<string, unknown>[];
  transactionFlags?: Record<string, unknown>;
  profileExecutionId?: string;
  principalTrn?: string;
  exchangeRate?: number;
  taxInclusiveAmountInAed?: number;
  references?: Record<string, unknown>;
  seller?: {
    endpointId?: string;
    endpointScheme?: string;
    legalRegistration?: Record<string, unknown>;
    contact?: Record<string, unknown>;
    addressLine3?: string;
  };
  buyer?: {
    endpointId?: string;
    endpointScheme?: string;
    legalRegistration?: Record<string, unknown>;
    contact?: Record<string, unknown>;
    addressLine3?: string;
  };
  lines?: Array<{
    unitCode?: string;
    itemDescription?: string;
    vatExemptionReason?: string;
    vatExemptionReasonCode?: string;
    rcmNatureCode?: string;
    classificationId?: string;
    classificationScheme?: string;
    accountingCost?: string;
    orderLineReferenceId?: string;
    invoicePeriod?: Record<string, unknown>;
    allowanceCharges?: Record<string, unknown>[];
  }>;
  [key: string]: unknown;
};

export type Invoice = {
  id: number;
  tenantId: string;
  integrationId: string;
  sourceSystem: string;
  sourceDocumentId: string;
  idempotencyKey?: string;
  invoiceNumber: string;
  sourceSystemDCNoteId?: string | null;
  documentType: string;
  status: string;
  issueDate: string;
  currencyCode: string;
  sellerName: string;
  sellerTrn?: string | null;
  sellerAddressLine1?: string | null;
  sellerAddressLine2?: string | null;
  sellerCity?: string | null;
  sellerState?: string | null;
  sellerPostalCode?: string | null;
  sellerCountryCode?: string;
  buyerName: string;
  buyerTrn?: string | null;
  buyerAddressLine1?: string | null;
  buyerAddressLine2?: string | null;
  buyerCity?: string | null;
  buyerState?: string | null;
  buyerPostalCode?: string | null;
  buyerCountryCode?: string;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  notes?: string | null;
  aspMessageId: string | null;
  aspReferenceId: string | null;
  aspResponse?: string | null;
  submissionAttempts: number;
  lastSubmissionError: string | null;
  lastSubmissionAt?: string | null;
  rejectionReason: string | null;
  submittedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  lines: InvoiceLine[];
  events: InvoiceEvent[];
  /** Parsed source-system pass-through fields from create request */
  sourcePayload?: InvoiceSourcePayload | null;
};

export const tenantApi = {
  list: () => api.get<Tenant[]>('/tenants').then(r => r.data),
  get: (id: string) => api.get<Tenant>(`/tenants/${id}`).then(r => r.data),
  getByCode: (code: string) => api.get<Tenant>(`/tenants/code/${code}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post<Tenant>('/tenants', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch<Tenant>(`/tenants/${id}`, data).then(r => r.data),
};

export const integrationApi = {
  list: (tenantId: string) => api.get<Integration[]>(`/tenants/${tenantId}/integrations`).then(r => r.data),
  get: (tenantId: string, id: string) => api.get<Integration>(`/tenants/${tenantId}/integrations/${id}`).then(r => r.data),
  create: (tenantId: string, data: Record<string, unknown>) => api.post<Integration>(`/tenants/${tenantId}/integrations`, data).then(r => r.data),
  update: (tenantId: string, id: string, data: Record<string, unknown>) => api.patch<Integration>(`/tenants/${tenantId}/integrations/${id}`, data).then(r => r.data),
  regenerateKeys: (tenantId: string, id: string) => api.post<Integration>(`/tenants/${tenantId}/integrations/${id}/regenerate-keys`).then(r => r.data),
};

export const invoiceApi = {
  list: () => api.get<Invoice[]>('/admin/invoices').then(r => r.data),
  get: (id: number | string) =>
    api.get<Invoice>(`/admin/invoices/${id}`).then((r) => r.data),
};

export default api;
