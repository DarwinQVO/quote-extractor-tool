import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Segment } from '@/lib/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  const { sourceId } = params;
  
  try {
    const transcript = await prisma.transcript.findUnique({
      where: { sourceId },
      include: { segments: true },
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
    
    return NextResponse.json({ 
      segments,
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