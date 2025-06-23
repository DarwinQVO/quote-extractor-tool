import { NextResponse } from 'next/server';
import { getPrismaClient, ensureDatabaseTables } from '@/lib/prisma';

export async function POST() {
  try {
    console.log('🔄 Updating citation formats for existing transcripts...');
    
    // Ensure database tables exist
    await ensureDatabaseTables();
    const prisma = getPrismaClient();
    
    // Get all transcripts with segments
    const transcripts = await prisma.transcript.findMany({
      include: {
        segments: true,
      },
    });
    
    if (transcripts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transcripts found to update',
        updated: 0,
      });
    }
    
    let updatedCount = 0;
    
    for (const transcript of transcripts) {
      console.log(`Processing transcript ${transcript.sourceId}...`);
      
      // For each segment, we would need to regenerate the citation
      // But since segments don't store citations directly, 
      // the new format will be applied when quotes are generated
      // from these segments in the frontend
      
      // Update the transcript's updatedAt to indicate processing
      await prisma.transcript.update({
        where: { id: transcript.id },
        data: { updatedAt: new Date() },
      });
      
      updatedCount++;
    }
    
    console.log(`✅ Updated ${updatedCount} transcripts`);
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} transcripts. New citation format will apply to new quotes.`,
      updated: updatedCount,
      note: 'Existing quotes will need to be regenerated to use new format',
    });
    
  } catch (error) {
    console.error('❌ Failed to update citations:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}