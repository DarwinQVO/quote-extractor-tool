import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const { action, sourceIds } = await request.json();
    
    if (action === 'delete-selected' && Array.isArray(sourceIds)) {
      // Delete selected sources and their related data
      for (const sourceId of sourceIds) {
        await prisma.quote.deleteMany({ where: { sourceId } });
        await prisma.transcript.deleteMany({ where: { sourceId } });
        await prisma.source.delete({ where: { id: sourceId } });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${sourceIds.length} sources and their related data` 
      });
    }
    
    if (action === 'delete-all-failed') {
      // Delete all sources with error status
      const failedSources = await prisma.source.findMany({
        where: { status: 'error' },
        select: { id: true }
      });
      
      for (const source of failedSources) {
        await prisma.quote.deleteMany({ where: { sourceId: source.id } });
        await prisma.transcript.deleteMany({ where: { sourceId: source.id } });
        await prisma.source.delete({ where: { id: source.id } });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${failedSources.length} failed transcripts` 
      });
    }
    
    if (action === 'delete-all-test') {
      // Delete sources that look like test data (short titles, common test URLs, etc.)
      const testSources = await prisma.source.findMany({
        where: {
          OR: [
            { title: { contains: 'test' } },
            { title: { contains: 'Test' } },
            { title: { contains: 'Loading...' } },
            { channel: '' },
            { duration: { lte: 60 } }, // Very short videos
          ]
        },
        select: { id: true }
      });
      
      for (const source of testSources) {
        await prisma.quote.deleteMany({ where: { sourceId: source.id } });
        await prisma.transcript.deleteMany({ where: { sourceId: source.id } });
        await prisma.source.delete({ where: { id: source.id } });
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${testSources.length} test transcripts` 
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk cleanup:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}