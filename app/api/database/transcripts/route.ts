import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const transcripts = await prisma.transcript.findMany();
    
    // Convert to Map format expected by the app
    const transcriptsMap: Record<string, any> = {};
    transcripts.forEach(transcript => {
      transcriptsMap[transcript.sourceId] = {
        sourceId: transcript.sourceId,
        segments: transcript.segments,
        words: transcript.words || [],
        speakers: transcript.speakers || [],
      };
    });
    
    return NextResponse.json(transcriptsMap);
  } catch (error) {
    console.error('Error loading transcripts from SQLite:', error);
    return NextResponse.json({ error: 'Failed to load transcripts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const transcriptsData = await request.json();
    
    // Handle both array format and single transcript
    const transcripts = Array.isArray(transcriptsData) ? transcriptsData : [transcriptsData];
    
    for (const transcript of transcripts) {
      await prisma.transcript.upsert({
        where: { sourceId: transcript.sourceId },
        update: {
          segments: transcript.segments,
          words: transcript.words || [],
          speakers: transcript.speakers || [],
        },
        create: {
          sourceId: transcript.sourceId,
          segments: transcript.segments,
          words: transcript.words || [],
          speakers: transcript.speakers || [],
        }
      });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving transcripts to SQLite:', error);
    return NextResponse.json({ error: 'Failed to save transcripts' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceId = searchParams.get('sourceId');
    
    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID required' }, { status: 400 });
    }
    
    await prisma.transcript.delete({ where: { sourceId } });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting transcript from SQLite:', error);
    return NextResponse.json({ error: 'Failed to delete transcript' }, { status: 500 });
  }
}