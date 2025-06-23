import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Try to query the database and get table information
    const result = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
    
    return NextResponse.json({
      status: 'connected',
      tables: result,
      databaseUrl: process.env.DATABASE_URL,
      message: 'Database connection successful'
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({
      status: 'error',
      error: err.message,
      databaseUrl: process.env.DATABASE_URL,
      tables: [],
      suggestion: 'Database may not be initialized'
    }, { status: 500 });
  }
}