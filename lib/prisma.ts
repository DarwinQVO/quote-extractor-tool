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

async function initializePrisma() {
  if (globalForPrisma.prismaInitialized) {
    return globalForPrisma.prisma!;
  }

  const client = new PrismaClient();
  
  try {
    // Try to connect and create tables if they don't exist
    console.log('🔄 Checking database connection...');
    await client.$connect();
    
    // Check if tables exist by trying a simple query
    try {
      await client.transcript.findFirst();
      console.log('✅ Database tables exist');
    } catch (error) {
      console.log('🔧 Database tables not found, attempting to create...');
      
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
      
      console.log('✅ Database tables created successfully');
    }
    
    globalForPrisma.prisma = client;
    globalForPrisma.prismaInitialized = true;
    
    return client;
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Create a proxy that initializes on first use
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!globalForPrisma.prisma) {
      // Return a promise-based method that initializes first
      return async (...args: any[]) => {
        const client = await initializePrisma();
        const method = (client as any)[prop];
        if (typeof method === 'function') {
          return method.apply(client, args);
        }
        return method;
      };
    }
    return globalForPrisma.prisma[prop as keyof PrismaClient];
  }
});

if (process.env.NODE_ENV !== 'production') {
  // Initialize immediately in development
  initializePrisma().catch(console.error);
}