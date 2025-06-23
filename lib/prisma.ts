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
    // Create a fresh client specifically for table creation
    const initClient = new PrismaClient();
    
    // Try to connect
    await initClient.$connect();
    console.log('🔗 Connected to database for initialization');
    
    // Create tables using raw SQL since we can't run migrations in Railway
    console.log('📝 Creating Transcript table...');
    await initClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Transcript" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sourceId" TEXT NOT NULL UNIQUE,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    console.log('📝 Creating Segment table...');
    await initClient.$executeRaw`
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
    
    console.log('📝 Creating Word table...');
    await initClient.$executeRaw`
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
    
    console.log('📝 Creating Speaker table...');
    await initClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Speaker" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "transcriptId" TEXT NOT NULL,
        "originalName" TEXT NOT NULL,
        "customName" TEXT NOT NULL,
        FOREIGN KEY ("transcriptId") REFERENCES "Transcript" ("id") ON DELETE CASCADE
      )
    `;
    
    // Create indexes
    console.log('🗂️ Creating indexes...');
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Segment_transcriptId_idx" ON "Segment"("transcriptId")`;
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Word_transcriptId_idx" ON "Word"("transcriptId")`;
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Word_start_idx" ON "Word"("start")`;
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Speaker_transcriptId_idx" ON "Speaker"("transcriptId")`;
    
    // Test that tables were created by running a simple query
    console.log('🧪 Testing table creation...');
    const tableTest = await initClient.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
    console.log('📊 Tables found:', tableTest);
    
    // Disconnect the init client
    await initClient.$disconnect();
    
    // Now create the global client fresh
    globalForPrisma.prisma = new PrismaClient();
    await globalForPrisma.prisma.$connect();
    globalForPrisma.prismaInitialized = true;
    
    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Function to get the initialized Prisma client
export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;