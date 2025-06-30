/**
 * Simplified Transcription API - Minimal Dependencies
 * Works with memory storage only, no external services required
 */

import { NextRequest, NextResponse } from 'next/server';
import { memoryStorage_ } from '@/lib/memory-storage';

// Simple mock transcription for testing
function generateMockTranscript(videoId: string, title: string) {
  return {
    sourceId: videoId,
    segments: [
      {
        id: 1,
        start: 0,
        end: 10,
        text: `This is a mock transcript for ${title}`,
        speaker: 'Speaker 1'
      },
      {
        id: 2,
        start: 10,
        end: 20,
        text: 'This demonstrates that the system is working without external dependencies.',
        speaker: 'Speaker 1'
      },
      {
        id: 3,
        start: 20,
        end: 30,
        text: 'The memory storage fallback system is functioning correctly.',
        speaker: 'Speaker 2'
      }
    ],
    words: [],
    speakers: ['Speaker 1', 'Speaker 2']
  };
}

export async function POST(request: NextRequest) {
  try {
    const { videoId, url } = await request.json();
    
    if (!videoId || !url) {
      return NextResponse.json({ 
        error: 'Video ID and URL are required' 
      }, { status: 400 });
    }

    console.log(`🚀 Simple transcript test for: ${videoId}`);

    // Step 1: Create mock source
    const source = {
      id: videoId,
      url: url,
      title: `Test Video ${videoId}`,
      channel: 'Test Channel',
      duration: 300,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      status: 'transcribing' as const,
      addedAt: new Date()
    };

    // Step 2: Save source to memory storage
    await memoryStorage_.sources.create(source);
    console.log('✅ Source saved to memory storage');

    // Step 3: Generate mock transcript
    const transcript = generateMockTranscript(videoId, source.title);
    
    // Step 4: Save transcript to memory storage
    await memoryStorage_.transcripts.save(transcript);
    console.log('✅ Transcript saved to memory storage');

    // Step 5: Update source status
    await memoryStorage_.sources.update(videoId, { status: 'ready' });
    console.log('✅ Source status updated to ready');

    // Step 6: Verify everything was saved
    const savedSource = await memoryStorage_.sources.findById(videoId);
    const savedTranscript = await memoryStorage_.transcripts.load(videoId);
    
    return NextResponse.json({
      success: true,
      message: 'Mock transcript created successfully',
      data: {
        source: savedSource,
        transcript: savedTranscript,
        memoryStats: memoryStorage_.stats.getSummary()
      }
    });

  } catch (error) {
    console.error('Simple transcript error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Error in simplified transcription system'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const videoId = searchParams.get('videoId');
    
    if (!videoId) {
      // Return memory storage stats
      return NextResponse.json({
        message: 'Simple transcript API is running',
        memoryStats: memoryStorage_.stats.getSummary(),
        allSources: await memoryStorage_.sources.findAll(),
        allTranscripts: await memoryStorage_.transcripts.findAll()
      });
    }
    
    // Get specific transcript
    const source = await memoryStorage_.sources.findById(videoId);
    const transcript = await memoryStorage_.transcripts.load(videoId);
    
    return NextResponse.json({
      found: !!(source && transcript),
      source,
      transcript
    });
    
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}