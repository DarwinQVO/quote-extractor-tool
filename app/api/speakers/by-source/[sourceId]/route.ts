import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Get speakers for a transcript by source ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  
  try {
    // First find the transcript by source ID
    const transcript = await prisma.transcript.findUnique({
      where: { sourceId },
      include: { speakers: true },
    });
    
    if (!transcript) {
      return NextResponse.json({ speakers: [] });
    }
    
    const speakers = transcript.speakers.map((speaker: { id: string; originalName: string; customName: string }) => ({
      id: speaker.id,
      originalName: speaker.originalName,
      customName: speaker.customName,
    }));
    
    return NextResponse.json({ speakers });
  } catch (error) {
    console.error('Error fetching speakers by source:', error);
    return NextResponse.json(
      { error: 'Failed to fetch speakers' },
      { status: 500 }
    );
  }
}

// Update speaker name by source ID
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  const { sourceId } = await params;
  const { speakerId, customName } = await request.json();
  
  if (!speakerId || !customName) {
    return NextResponse.json(
      { error: 'Speaker ID and custom name are required' },
      { status: 400 }
    );
  }
  
  try {
    // Find the transcript by source ID
    const transcript = await prisma.transcript.findUnique({
      where: { sourceId },
      include: { speakers: true },
    });
    
    if (!transcript) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }
    
    // Update the speaker
    const speaker = await prisma.speaker.update({
      where: { 
        id: speakerId,
        transcriptId: transcript.id,
      },
      data: { customName },
    });
    
    // Update all segments with this speaker's original name to use the new custom name
    await prisma.segment.updateMany({
      where: {
        transcriptId: transcript.id,
        speaker: speaker.originalName,
      },
      data: {
        speaker: customName,
      },
    });
    
    return NextResponse.json({ speaker, updated: true });
  } catch (error) {
    console.error('Error updating speaker by source:', error);
    return NextResponse.json(
      { error: 'Failed to update speaker' },
      { status: 500 }
    );
  }
}