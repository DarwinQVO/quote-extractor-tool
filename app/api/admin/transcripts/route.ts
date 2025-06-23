import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient, ensureDatabaseTables } from '@/lib/prisma';

export async function GET() {
  try {
    console.log('🔍 Checking database transcripts...');
    
    // Ensure database tables exist
    await ensureDatabaseTables();
    const prisma = getPrismaClient();
    
    // Get all transcripts with their segments count
    const transcripts = await prisma.transcript.findMany({
      include: {
        segments: {
          select: {
            id: true,
            speaker: true,
            start: true,
            end: true,
            text: true,
          },
        },
        words: {
          select: {
            id: true,
          },
        },
        speakers: {
          select: {
            id: true,
            originalName: true,
            customName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    const transcriptSummary = transcripts.map(transcript => ({
      id: transcript.id,
      sourceId: transcript.sourceId,
      createdAt: transcript.createdAt,
      updatedAt: transcript.updatedAt,
      segmentsCount: transcript.segments.length,
      wordsCount: transcript.words.length,
      speakersCount: transcript.speakers.length,
      speakers: transcript.speakers.map(s => s.originalName),
      firstSegment: transcript.segments[0]?.text?.substring(0, 100) + '...' || 'No segments',
    }));
    
    console.log(`✅ Found ${transcripts.length} transcripts in database`);
    
    return NextResponse.json({
      success: true,
      count: transcripts.length,
      transcripts: transcriptSummary,
    });
    
  } catch (error) {
    console.error('❌ Failed to get transcripts:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transcriptId = searchParams.get('id');
    const sourceId = searchParams.get('sourceId');
    
    if (!transcriptId && !sourceId) {
      return NextResponse.json({
        error: 'Either transcriptId or sourceId is required'
      }, { status: 400 });
    }
    
    console.log(`🗑️ Deleting transcript: ${transcriptId || sourceId}`);
    
    // Ensure database tables exist
    await ensureDatabaseTables();
    const prisma = getPrismaClient();
    
    // Delete transcript (cascade will handle related records)
    let deletedTranscript;
    if (transcriptId) {
      deletedTranscript = await prisma.transcript.delete({
        where: { id: transcriptId },
      });
    } else {
      deletedTranscript = await prisma.transcript.delete({
        where: { sourceId: sourceId! },
      });
    }
    
    console.log(`✅ Deleted transcript: ${deletedTranscript.id}`);
    
    return NextResponse.json({
      success: true,
      message: `Transcript deleted successfully`,
      deletedId: deletedTranscript.id,
      deletedSourceId: deletedTranscript.sourceId,
    });
    
  } catch (error) {
    console.error('❌ Failed to delete transcript:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}