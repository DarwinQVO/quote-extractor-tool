import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Ensure DATABASE_URL is set for Prisma
if (!process.env.DATABASE_URL) {
  console.log('🔧 Setting default DATABASE_URL for Prisma');
  process.env.DATABASE_URL = 'file:./dev.db';
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;