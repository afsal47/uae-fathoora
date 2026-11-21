-- Remove unused tenant profile/address columns (invoice seller address comes from invoice payload).
-- Legal entity address fields are kept.

DECLARE @constraintName NVARCHAR(256);
SELECT @constraintName = dc.name
FROM sys.default_constraints dc
JOIN sys.columns c
  ON c.default_object_id = dc.object_id
WHERE dc.parent_object_id = OBJECT_ID(N'dbo.tenants')
  AND c.name = N'countryCode';

IF @constraintName IS NOT NULL
  EXEC(N'ALTER TABLE [dbo].[tenants] DROP CONSTRAINT [' + @constraintName + N']');

IF COL_LENGTH('dbo.tenants', 'phone') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [phone];

IF COL_LENGTH('dbo.tenants', 'addressLine1') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [addressLine1];

IF COL_LENGTH('dbo.tenants', 'addressLine2') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [addressLine2];

IF COL_LENGTH('dbo.tenants', 'city') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [city];

IF COL_LENGTH('dbo.tenants', 'state') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [state];

IF COL_LENGTH('dbo.tenants', 'postalCode') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [postalCode];

IF COL_LENGTH('dbo.tenants', 'countryCode') IS NOT NULL
  ALTER TABLE [dbo].[tenants] DROP COLUMN [countryCode];
