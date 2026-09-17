import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPgVector() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('SUCCESS: pgvector extension enabled!');
    const result = await prisma.$queryRawUnsafe(`SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';`);
    console.log('Extension details:', result);
  } catch (err) {
    console.error('ERROR enabling pgvector:', err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPgVector();
