import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitialized: boolean;
};

// Ensure DATABASE_URL is set for Prisma
if (!process.env.DATABASE_URL) {
  console.log('🔧 Setting default DATABASE_URL for Prisma');
  process.env.DATABASE_URL = 'file:./dev.db';
}

export async function ensureDatabaseTables() {
  if (globalForPrisma.prismaInitialized) {
    return;
  }

  console.log('🔄 Initializing database tables...');
  
  try {
    const client = globalForPrisma.prisma || new PrismaClient();
    
    // Try to connect
    await client.$connect();
    
    // Create tables using raw SQL since we can't run migrations in Railway
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Transcript" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sourceId" TEXT NOT NULL UNIQUE,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Segment" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "transcriptId" TEXT NOT NULL,
        "start" REAL NOT NULL,
        "end" REAL NOT NULL,
        "speaker" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE
      )
    `;
    
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Word" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "transcriptId" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "start" REAL NOT NULL,
        "end" REAL NOT NULL,
        "speaker" TEXT,
        FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE
      )
    `;
    
    await client.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Speaker" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "transcriptId" TEXT NOT NULL,
        "originalName" TEXT NOT NULL,
        "customName" TEXT NOT NULL,
        FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE
      )
    `;
    
    // Create indexes
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "Segment_transcriptId_idx" ON "Segment"("transcriptId")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "Word_transcriptId_idx" ON "Word"("transcriptId")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "Word_start_idx" ON "Word"("start")`;
    await client.$executeRaw`CREATE INDEX IF NOT EXISTS "Speaker_transcriptId_idx" ON "Speaker"("transcriptId")`;
    
    globalForPrisma.prisma = client;
    globalForPrisma.prismaInitialized = true;
    
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;