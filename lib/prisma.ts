import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma_v2: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsappeando?schema=public';
const accelerateUrl = process.env.PRISMA_DATABASE_URL;

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma_v2 ?? (
  accelerateUrl
    ? new PrismaClient({ accelerateUrl }) as any
    : new PrismaClient({ adapter })
);
console.log('📦 Prisma initialized (v2)');

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma_v2 = prisma;
}
