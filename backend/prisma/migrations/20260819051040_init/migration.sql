BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[tenants] (
    [id] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [trn] NVARCHAR(50),
    [email] NVARCHAR(200),
    [phone] NVARCHAR(50),
    [addressLine1] NVARCHAR(200),
    [addressLine2] NVARCHAR(200),
    [city] NVARCHAR(100),
    [state] NVARCHAR(100),
    [postalCode] NVARCHAR(50),
    [countryCode] NVARCHAR(2) NOT NULL CONSTRAINT [tenants_countryCode_df] DEFAULT 'AE',
    [aspProvider] NVARCHAR(50) NOT NULL CONSTRAINT [tenants_aspProvider_df] DEFAULT 'FAKE',
    [aspBaseUrl] NVARCHAR(500),
    [aspApiKey] NVARCHAR(500),
    [aspWebhookToken] NVARCHAR(500),
    [isActive] BIT NOT NULL CONSTRAINT [tenants_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [tenants_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [tenants_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [tenants_code_key] UNIQUE NONCLUSTERED ([code])
);

-- CreateTable
CREATE TABLE [dbo].[integrations] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [code] NVARCHAR(100) NOT NULL,
    [name] NVARCHAR(200) NOT NULL,
    [authType] NVARCHAR(50) NOT NULL CONSTRAINT [integrations_authType_df] DEFAULT 'API_KEY_HMAC',
    [apiKey] NVARCHAR(200) NOT NULL,
    [apiSecret] NVARCHAR(500) NOT NULL,
    [webhookUrl] NVARCHAR(500),
    [webhookSecret] NVARCHAR(500),
    [allowedIpRanges] NVARCHAR(1000),
    [isActive] BIT NOT NULL CONSTRAINT [integrations_isActive_df] DEFAULT 1,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [integrations_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [integrations_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [integrations_tenantId_code_key] UNIQUE NONCLUSTERED ([tenantId],[code])
);

-- CreateTable
CREATE TABLE [dbo].[invoices] (
    [id] NVARCHAR(1000) NOT NULL,
    [tenantId] NVARCHAR(1000) NOT NULL,
    [integrationId] NVARCHAR(1000) NOT NULL,
    [sourceSystem] NVARCHAR(100) NOT NULL,
    [sourceDocumentId] NVARCHAR(100) NOT NULL,
    [idempotencyKey] NVARCHAR(200) NOT NULL,
    [invoiceNumber] NVARCHAR(100) NOT NULL,
    [documentType] NVARCHAR(50) NOT NULL,
    [status] NVARCHAR(50) NOT NULL CONSTRAINT [invoices_status_df] DEFAULT 'DRAFT',
    [issueDate] DATETIME2 NOT NULL,
    [currencyCode] NVARCHAR(3) NOT NULL CONSTRAINT [invoices_currencyCode_df] DEFAULT 'AED',
    [sellerName] NVARCHAR(200) NOT NULL,
    [sellerTrn] NVARCHAR(50),
    [sellerAddressLine1] NVARCHAR(200),
    [sellerAddressLine2] NVARCHAR(200),
    [sellerCity] NVARCHAR(100),
    [sellerState] NVARCHAR(100),
    [sellerPostalCode] NVARCHAR(50),
    [sellerCountryCode] NVARCHAR(2) NOT NULL CONSTRAINT [invoices_sellerCountryCode_df] DEFAULT 'AE',
    [buyerName] NVARCHAR(200) NOT NULL,
    [buyerTrn] NVARCHAR(50),
    [buyerAddressLine1] NVARCHAR(200),
    [buyerAddressLine2] NVARCHAR(200),
    [buyerCity] NVARCHAR(100),
    [buyerState] NVARCHAR(100),
    [buyerPostalCode] NVARCHAR(50),
    [buyerCountryCode] NVARCHAR(2) NOT NULL CONSTRAINT [invoices_buyerCountryCode_df] DEFAULT 'AE',
    [subtotalAmount] DECIMAL(18,2) NOT NULL,
    [taxAmount] DECIMAL(18,2) NOT NULL,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [notes] NVARCHAR(1000),
    [aspMessageId] NVARCHAR(100),
    [aspReferenceId] NVARCHAR(100),
    [aspPayload] NVARCHAR(max),
    [aspResponse] NVARCHAR(max),
    [submissionAttempts] INT NOT NULL CONSTRAINT [invoices_submissionAttempts_df] DEFAULT 0,
    [lastSubmissionError] NVARCHAR(2000),
    [lastSubmissionAt] DATETIME2,
    [rejectionReason] NVARCHAR(2000),
    [submittedAt] DATETIME2,
    [acceptedAt] DATETIME2,
    [rejectedAt] DATETIME2,
    [cancelledAt] DATETIME2,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [invoices_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [invoices_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [invoices_tenantId_sourceSystem_sourceDocumentId_documentType_key] UNIQUE NONCLUSTERED ([tenantId],[sourceSystem],[sourceDocumentId],[documentType]),
    CONSTRAINT [invoices_tenantId_integrationId_idempotencyKey_key] UNIQUE NONCLUSTERED ([tenantId],[integrationId],[idempotencyKey]),
    CONSTRAINT [invoices_tenantId_invoiceNumber_documentType_key] UNIQUE NONCLUSTERED ([tenantId],[invoiceNumber],[documentType])
);

-- CreateTable
CREATE TABLE [dbo].[invoice_lines] (
    [id] NVARCHAR(1000) NOT NULL,
    [invoiceId] NVARCHAR(1000) NOT NULL,
    [lineNumber] INT NOT NULL,
    [description] NVARCHAR(500) NOT NULL,
    [quantity] DECIMAL(18,4) NOT NULL,
    [unitPrice] DECIMAL(18,2) NOT NULL,
    [netAmount] DECIMAL(18,2) NOT NULL,
    [vatRate] DECIMAL(5,2) NOT NULL,
    [vatCategory] NVARCHAR(20) NOT NULL,
    [taxAmount] DECIMAL(18,2) NOT NULL,
    [totalAmount] DECIMAL(18,2) NOT NULL,
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [invoice_lines_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [updatedAt] DATETIME2 NOT NULL,
    CONSTRAINT [invoice_lines_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [invoice_lines_invoiceId_lineNumber_key] UNIQUE NONCLUSTERED ([invoiceId],[lineNumber])
);

-- CreateTable
CREATE TABLE [dbo].[invoice_events] (
    [id] NVARCHAR(1000) NOT NULL,
    [invoiceId] NVARCHAR(1000) NOT NULL,
    [type] NVARCHAR(50) NOT NULL,
    [fromStatus] NVARCHAR(50),
    [toStatus] NVARCHAR(50),
    [message] NVARCHAR(1000) NOT NULL,
    [payload] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [invoice_events_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [invoice_events_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_tenantId_status_idx] ON [dbo].[invoices]([tenantId], [status]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoices_integrationId_sourceDocumentId_idx] ON [dbo].[invoices]([integrationId], [sourceDocumentId]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [invoice_events_invoiceId_createdAt_idx] ON [dbo].[invoice_events]([invoiceId], [createdAt]);

-- AddForeignKey
ALTER TABLE [dbo].[integrations] ADD CONSTRAINT [integrations_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_tenantId_fkey] FOREIGN KEY ([tenantId]) REFERENCES [dbo].[tenants]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoices] ADD CONSTRAINT [invoices_integrationId_fkey] FOREIGN KEY ([integrationId]) REFERENCES [dbo].[integrations]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[invoice_lines] ADD CONSTRAINT [invoice_lines_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[invoice_events] ADD CONSTRAINT [invoice_events_invoiceId_fkey] FOREIGN KEY ([invoiceId]) REFERENCES [dbo].[invoices]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
