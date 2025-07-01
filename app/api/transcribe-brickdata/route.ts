import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { saveSource, saveTranscript } from '@/lib/database';
import path from 'path';

const execAsync = promisify(exec);

/**
 * BrickData Proxy Transcription Endpoint
 * Uses Python microservice with BrickData residential proxy
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🌐 BRICKDATA TRANSCRIPTION STARTING');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const { sourceId, url } = await request.json();
    
    if (!sourceId || !url) {
      return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
    }
    
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId || videoId === 'unknown') {
      return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }
    
    console.log('🎯 Video ID:', videoId);
    console.log('🆔 Source ID:', sourceId);
    
    // Check Bright Data proxy configuration
    const proxyConfig = {
      host: process.env.PROXY_HOST || process.env.BRIGHTDATA_HOST,
      port: process.env.PROXY_PORT || process.env.BRIGHTDATA_PORT,
      user: process.env.PROXY_USER || process.env.BRIGHTDATA_USER,
      pass: process.env.PROXY_PASS || process.env.BRIGHTDATA_PASS
    };
    
    if (!proxyConfig.host || !proxyConfig.port || !proxyConfig.user || !proxyConfig.pass) {
      console.log('⚠️ Missing Bright Data proxy configuration');
      return NextResponse.json({ 
        error: 'Bright Data proxy not configured',
        details: 'Please set PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS environment variables'
      }, { status: 500 });
    }
    
    console.log(`🌐 Using Bright Data proxy: ${proxyConfig.host}:${proxyConfig.port}`);
    
    // Save initial source metadata
    const initialSource = {
      id: sourceId,
      url: url,
      title: `YouTube Video ${videoId}`,
      channel: 'Processing...',
      description: 'Transcribing with BrickData proxy...',
      duration: 300,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      addedAt: new Date(),
      uploadDate: new Date(),
      status: 'ready' as const,
      videoStatus: 'ready' as const,
      transcriptStatus: 'transcribing' as const,
      videoRetryCount: 0
    };
    
    await saveSource(initialSource);
    console.log('✅ Initial source saved');
    
    // Prepare Python transcription command
    const pythonScript = path.join(process.cwd(), 'transcription', 'main.py');
    const pythonEnv = {
      ...process.env,
      PROXY_HOST: proxyConfig.host,
      PROXY_PORT: proxyConfig.port,
      PROXY_USER: proxyConfig.user,
      PROXY_PASS: proxyConfig.pass,
      WHISPER_MODEL_SIZE: process.env.WHISPER_MODEL_SIZE || 'medium'
    };
    
    console.log('🐍 Starting Python transcription process...');
    console.log(`📄 Script: ${pythonScript}`);
    console.log(`🎯 Video ID: ${videoId}`);
    
    // Execute Python transcription with optimized timeout and error handling
    const transcriptionTimeout = 180000; // 3 minutes - enterprise optimization
    
    console.log('🚀 ENTERPRISE: Starting optimized Bright Data transcription...');
    
    try {
      const { stdout, stderr } = await execAsync(
        `timeout 180 python3 "${pythonScript}" "${videoId}"`,
        {
          env: pythonEnv,
          timeout: transcriptionTimeout,
          maxBuffer: 25 * 1024 * 1024, // 25MB buffer for large outputs
          killSignal: 'SIGTERM'
        }
      );
      
      console.log('✅ Python process completed within timeout');
      console.log('📝 Python transcription output:');
      console.log(stdout);
      
      if (stderr) {
        console.log('⚠️ Python transcription stderr:');
        console.log(stderr);
      }
    } catch (pythonError) {
      console.error('❌ Python transcription process failed:', pythonError);
      
      // Handle timeout specifically
      if (pythonError.signal === 'SIGTERM' || pythonError.code === 'TIMEOUT') {
        console.log('⏰ Transcription timeout - video may be too long or proxy slow');
        return NextResponse.json({
          error: 'Transcription timeout',
          details: 'Video processing took too long. Try a shorter video or check proxy speed.'
        }, { status: 408 });
      }
      
      throw pythonError;
    }
    
    // Parse transcription result from stdout
    let transcriptText = '';
    const lines = stdout.split('\\n');
    let isTranscriptSection = false;
    
    for (const line of lines) {
      if (line.includes('📝 Transcript:')) {
        isTranscriptSection = true;
        continue;
      }
      if (line.includes('--------------------------------------------------')) {
        if (isTranscriptSection) {
          break; // End of transcript
        }
        isTranscriptSection = true;
        continue;
      }
      if (isTranscriptSection && line.trim()) {
        transcriptText += line.trim() + ' ';
      }
    }
    
    transcriptText = transcriptText.trim();
    
    if (!transcriptText) {
      console.log('❌ No transcript text extracted from Python output');
      return NextResponse.json({ 
        error: 'Transcription failed',
        details: 'No transcript text was extracted'
      }, { status: 500 });
    }
    
    console.log(`✅ Extracted transcript: ${transcriptText.length} characters`);
    
    // Create transcript segments from the full text
    // Split into roughly equal segments for better UX
    const words = transcriptText.split(' ');
    const segmentSize = Math.max(10, Math.floor(words.length / 8)); // ~8 segments
    const segments = [];
    const segmentDuration = 30; // 30 seconds per segment
    
    for (let i = 0; i < words.length; i += segmentSize) {
      const segmentWords = words.slice(i, i + segmentSize);
      const segmentIndex = Math.floor(i / segmentSize);
      
      segments.push({
        start: segmentIndex * segmentDuration,
        end: (segmentIndex + 1) * segmentDuration,
        text: segmentWords.join(' '),
        speaker: 'Speaker 1'
      });
    }
    
    // Create word-level data
    const wordsData = [];
    const totalDuration = segments.length * segmentDuration;
    const wordDuration = totalDuration / words.length;
    
    words.forEach((word, index) => {
      wordsData.push({
        word: word,
        start: index * wordDuration,
        end: (index + 1) * wordDuration,
        confidence: 0.95
      });
    });
    
    // Create final transcript object
    const transcript = {
      id: sourceId,
      sourceId,
      segments,
      words: wordsData,
      text: transcriptText,
      language: 'es', // BrickData configured for Spanish
      createdAt: new Date(),
      duration: totalDuration
    };
    
    // Save transcript to database
    await saveTranscript(sourceId, transcript);
    console.log('✅ Transcript saved to database');
    
    // Update source status
    await saveSource({
      ...initialSource,
      title: `Transcribed Video ${videoId}`,
      channel: 'BrickData Transcription',
      description: `Transcribed via BrickData proxy: ${transcriptText.substring(0, 200)}...`,
      duration: totalDuration,
      transcriptStatus: 'ready'
    });
    
    console.log('🎉 BRICKDATA TRANSCRIPTION COMPLETED');
    console.log('Processing time:', Math.round((Date.now() - startTime) / 1000), 'seconds');
    
    return NextResponse.json({
      success: true,
      video: {
        id: sourceId,
        title: `Transcribed Video ${videoId}`,
        channel: 'BrickData Transcription',
        duration: totalDuration,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      },
      transcript: {
        segments: segments.length,
        words: wordsData.length,
        duration: totalDuration,
        method: 'brickdata-whisper',
        language: 'es'
      },
      processingTime: Math.round((Date.now() - startTime) / 1000)
    });
    
  } catch (error) {
    console.error('❌ BRICKDATA TRANSCRIPTION ERROR:', error);
    
    // Check if it's a timeout error
    if (error instanceof Error && error.message.includes('timeout')) {
      return NextResponse.json({
        error: 'Transcription timeout',
        details: 'The transcription process took too long. Try with a shorter video.'
      }, { status: 408 });
    }
    
    return NextResponse.json({
      error: 'BrickData transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function extractVideoId(url: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  
  return 'unknown';
}