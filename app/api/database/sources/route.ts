import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const sources = await prisma.source.findMany({
      orderBy: { addedAt: 'desc' }
    });
    
    return NextResponse.json(sources);
  } catch (error) {
    console.error('Error loading sources from SQLite:', error);
    return NextResponse.json({ error: 'Failed to load sources' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sources = await request.json();
    
    if (!Array.isArray(sources)) {
      return NextResponse.json({ error: 'Sources must be an array' }, { status: 400 });
    }
    
    // Upsert all sources
    for (const source of sources) {
      await prisma.source.upsert({
        where: { id: source.id },
        update: {
          url: source.url,
          title: source.title,
          channel: source.channel,
          duration: source.duration,
          thumbnail: source.thumbnail,
          description: source.description,
          uploadDate: source.uploadDate ? new Date(source.uploadDate) : null,
          viewCount: source.viewCount,
          status: source.status,
          error: source.error,
        },
        create: {
          id: source.id,
          url: source.url,
          title: source.title,
          channel: source.channel,
          duration: source.duration,
          thumbnail: source.thumbnail,
          description: source.description,
          uploadDate: source.uploadDate ? new Date(source.uploadDate) : null,
          viewCount: source.viewCount,
          status: source.status,
          error: source.error,
          addedAt: new Date(source.addedAt),
        }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving sources to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save sources' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('id');
    
    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 });
    }
    
    // Delete related data first
    await prisma.quote.deleteMany({ where: { sourceId } });
    await prisma.transcript.deleteMany({ where: { sourceId } });
    await prisma.source.delete({ where: { id: sourceId } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting source from SQLite:', error);
    return NextResponse.json({ error: 'Failed to delete source' }, { status: 500 });
  }
}