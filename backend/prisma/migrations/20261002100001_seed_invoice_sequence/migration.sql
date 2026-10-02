-- Seed sequence from existing invoice count per tenant (separate batch so SQL Server sees the new column).
UPDATE t
SET t.[invoiceSequence] = s.cnt
FROM [dbo].[tenants] t
INNER JOIN (
  SELECT [tenantId], COUNT(*) AS cnt
  FROM [dbo].[invoices]
  GROUP BY [tenantId]
) s ON s.[tenantId] = t.[id];
