IF COL_LENGTH('dbo.legal_entities', 'phone') IS NOT NULL
  ALTER TABLE [dbo].[legal_entities] DROP COLUMN [phone];
