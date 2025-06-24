import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaInitialized: boolean;
};

// Railway PostgreSQL setup
function getDatabaseUrl(): string {
  // Railway provides DATABASE_URL when PostgreSQL service is added
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  
  // Local development fallback to SQLite
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Using local SQLite for development');
    return 'file:./dev.db';
  }
  
  // Production fallback to SQLite with persistent volume
  console.log('⚠️ PostgreSQL not configured, using shared SQLite in production');
  return 'file:/app/data/shared.db';
}

export async function ensureDatabaseTables() {
  if (globalForPrisma.prismaInitialized) {
    return;
  }

  console.log('🔄 Initializing database connection...');
  
  try {
    // Create a fresh client for initialization
    const initClient = new PrismaClient({
      datasources: {
        db: {
          url: getDatabaseUrl()
        }
      }
    });
    
    // Try to connect
    await initClient.$connect();
    console.log('🔗 Connected to database');
    
    // Test connection and create tables if needed
    const dbType = process.env.DATABASE_URL?.includes('postgresql') ? 'postgresql' : 'sqlite';
    console.log(`📊 Using ${dbType} database`);
    
    // SQLite table creation (works for both dev and production)
    await initClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Source" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "url" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "channel" TEXT NOT NULL,
        "duration" INTEGER DEFAULT 0,
        "thumbnail" TEXT DEFAULT '',
        "description" TEXT,
        "uploadDate" DATETIME,
        "viewCount" INTEGER,
        "status" TEXT DEFAULT 'pending',
        "error" TEXT,
        "addedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await initClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Quote" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sourceId" TEXT NOT NULL,
        "text" TEXT NOT NULL,
        "speaker" TEXT NOT NULL,
        "startTime" REAL NOT NULL,
        "endTime" REAL NOT NULL,
        "citation" TEXT NOT NULL,
        "timestampLink" TEXT NOT NULL,
        "exported" INTEGER DEFAULT 0,
        "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE
      )
    `;
    
    await initClient.$executeRaw`
      CREATE TABLE IF NOT EXISTS "Transcript" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sourceId" TEXT NOT NULL UNIQUE,
        "segments" TEXT DEFAULT '[]',
        "words" TEXT DEFAULT '[]',
        "speakers" TEXT DEFAULT '[]',
        "createdAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE
      )
    `;
    
    // Create indexes
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Quote_sourceId_idx" ON "Quote"("sourceId")`;
    await initClient.$executeRaw`CREATE INDEX IF NOT EXISTS "Transcript_sourceId_idx" ON "Transcript"("sourceId")`;
    
    // Test that tables were created
    console.log('🧪 Testing database tables...');
    try {
      await initClient.source.findFirst();
      await initClient.quote.findFirst();
      await initClient.transcript.findFirst();
    } catch (error) {
      console.log('📋 Tables created successfully');
    }
    
    // Disconnect the init client
    await initClient.$disconnect();
    
    // Now create the global client
    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: {
          url: getDatabaseUrl()
        }
      }
    });
    await globalForPrisma.prisma.$connect();
    globalForPrisma.prismaInitialized = true;
    
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Function to get the initialized Prisma client
export function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: {
          url: getDatabaseUrl()
        }
      }
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = getPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;