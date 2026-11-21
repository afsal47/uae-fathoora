const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const tables = [
  'invoice_events',
  'invoice_lines',
  'invoices',
  'asp_credentials',
  'asp_connections',
  'asp_provider_api_configs',
  'integrations',
  'legal_entities',
  'asp_providers',
  'tenants',
];

async function main() {
  for (const table of tables) {
    const rows = await prisma.$executeRawUnsafe(`DELETE FROM dbo.[${table}]`);
    console.log(`cleared ${table} rows=${rows}`);
  }

  await prisma.$executeRawUnsafe(`DBCC CHECKIDENT ('dbo.invoices', RESEED, 0)`);
  console.log('reseeded invoices identity');
  console.log('DONE');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
