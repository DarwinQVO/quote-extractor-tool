import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get speakers for a transcript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  const { transcriptId } = await params;
  
  try {
    const speakers = await prisma.speaker.findMany({
      where: { transcriptId },
      orderBy: { originalName: 'asc' },
    });
    
    return NextResponse.json({ speakers });
  } catch (error) {
    console.error('Error fetching speakers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch speakers' },
      { status: 500 }
    );
  }
}

// Update speaker name
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ transcriptId: string }> }
) {
  const { transcriptId } = await params;
  const { speakerId, customName } = await request.json();
  
  if (!speakerId || !customName) {
    return NextResponse.json(
      { error: 'Speaker ID and custom name are required' },
      { status: 400 }
    );
  }
  
  try {
    const speaker = await prisma.speaker.update({
      where: { 
        id: speakerId,
        transcriptId: transcriptId,
      },
      data: { customName },
    });
    
    // Update all segments with this speaker's original name to use the new custom name
    await prisma.segment.updateMany({
      where: {
        transcriptId: transcriptId,
        speaker: speaker.originalName,
      },
      data: {
        speaker: customName,
      },
    });
    
    return NextResponse.json({ speaker, updated: true });
  } catch (error) {
    console.error('Error updating speaker:', error);
    return NextResponse.json(
      { error: 'Failed to update speaker' },
      { status: 500 }
    );
  }
}