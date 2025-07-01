import { NextRequest, NextResponse } from 'next/server';
import { saveTranscript } from '@/lib/database';

/**
 * HYBRID ARCHITECTURE: Receive transcript from local processor
 * This endpoint receives transcripts processed locally to avoid IP restrictions
 */
export async function POST(request: NextRequest) {
  try {
    const { sourceId, transcript } = await request.json();
    
    console.log('☁️ CLOUD: Receiving transcript from local processor:', sourceId);
    
    if (!sourceId || !transcript) {
      return NextResponse.json({ error: 'Missing sourceId or transcript' }, { status: 400 });
    }
    
    // Save transcript to cloud database
    const fullTranscript = {
      id: sourceId,
      sourceId,
      segments: transcript.segments || [],
      words: transcript.words || [],
      text: transcript.text || '',
      language: transcript.language || 'en',
      createdAt: new Date(),
      duration: transcript.duration || 0
    };
    
    await saveTranscript(sourceId, fullTranscript);
    console.log('✅ CLOUD: Transcript saved to database');
    
    return NextResponse.json({ 
      success: true,
      message: 'Transcript received and saved'
    });
    
  } catch (error) {
    console.error('❌ CLOUD: Failed to save local transcript:', error);
    return NextResponse.json({ 
      error: 'Failed to save transcript',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}