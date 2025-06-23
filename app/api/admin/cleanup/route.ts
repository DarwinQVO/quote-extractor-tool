import { NextRequest, NextResponse } from 'next/server';
import { getPrismaClient, ensureDatabaseTables } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, confirm } = body;
    
    if (action !== 'cleanup' || confirm !== 'YES_DELETE_ALL') {
      return NextResponse.json({
        error: 'Invalid action or confirmation. Use action: "cleanup" and confirm: "YES_DELETE_ALL"'
      }, { status: 400 });
    }
    
    console.log('🧹 Starting database cleanup...');
    
    // Ensure database tables exist
    await ensureDatabaseTables();
    const prisma = getPrismaClient();
    
    // Count current data
    const counts = await Promise.all([
      prisma.transcript.count(),
      prisma.segment.count(),
      prisma.word.count(),
      prisma.speaker.count(),
    ]);
    
    const [transcriptsCount, segmentsCount, wordsCount, speakersCount] = counts;
    
    console.log(`📊 Current counts: ${transcriptsCount} transcripts, ${segmentsCount} segments, ${wordsCount} words, ${speakersCount} speakers`);
    
    // Delete all data (cascade will handle related records)
    const deletedTranscripts = await prisma.transcript.deleteMany({});
    
    console.log(`✅ Cleanup complete: ${deletedTranscripts.count} transcripts deleted`);
    
    return NextResponse.json({
      success: true,
      message: 'Database cleanup completed',
      deletedCounts: {
        transcripts: deletedTranscripts.count,
        estimatedSegments: segmentsCount,
        estimatedWords: wordsCount,
        estimatedSpeakers: speakersCount,
      },
    });
    
  } catch (error) {
    console.error('❌ Failed to cleanup database:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}