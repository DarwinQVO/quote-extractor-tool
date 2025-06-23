import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Segment } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  
  try {
    const transcript = await prisma.transcript.findUnique({
      where: { sourceId },
      include: { 
        segments: true,
        words: true,
        speakers: true,
      },
    });
    
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }
    
    const segments: Segment[] = transcript.segments.map(s => ({
      speaker: s.speaker,
      start: s.start,
      end: s.end,
      text: s.text,
    }));

    const words = transcript.words?.map(w => ({
      text: w.text,
      start: w.start,
      end: w.end,
      speaker: w.speaker,
    })) || [];

    const speakers = transcript.speakers?.map(s => ({
      id: s.id,
      originalName: s.originalName,
      customName: s.customName,
    })) || [];
    
    return NextResponse.json({ 
      segments,
      words,
      speakers,
      createdAt: transcript.createdAt,
      updatedAt: transcript.updatedAt,
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}