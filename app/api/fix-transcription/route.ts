import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { saveTranscript } from '@/lib/database';

const execAsync = promisify(exec);

// Simplified transcription endpoint that bypasses complex proxy logic
export async function POST(request: NextRequest) {
  console.log('🚀 SIMPLIFIED TRANSCRIPTION STARTING');
  
  try {
    const { sourceId, url } = await request.json();
    
    if (!sourceId || !url) {
      return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
    }
    
    console.log('📝 Processing:', url);
    
    // Strategy 1: Try to get captions first (no download needed)
    console.log('🎯 STRATEGY 1: Extracting captions...');
    try {
      const { stdout: captionsData } = await execAsync(
        `yt-dlp --write-auto-sub --skip-download --sub-format vtt --no-warnings "${url}"`,
        { timeout: 30000 }
      );
      
      if (captionsData.includes('.vtt')) {
        console.log('✅ Captions found, processing...');
        
        // Read the VTT file and convert to transcript
        const vttFiles = captionsData.match(/\S+\.vtt/g);
        if (vttFiles && vttFiles[0]) {
          const { stdout: vttContent } = await execAsync(`cat "${vttFiles[0]}"`);
          
          // Parse VTT to segments
          const segments = parseVTTToSegments(vttContent);
          
          const transcript = {
            id: sourceId,
            sourceId,
            segments,
            text: segments.map(s => s.text).join(' '),
            language: 'en',
            createdAt: new Date(),
            duration: segments[segments.length - 1]?.end || 0
          };
          
          await saveTranscript(sourceId, transcript);
          console.log('✅ Captions transcript saved');
          
          // Cleanup
          await execAsync(`rm -f *.vtt`).catch(() => {});
          
          return NextResponse.json({ 
            success: true, 
            method: 'captions',
            segments: segments.length
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Captions extraction failed, trying audio...');
    }
    
    // Strategy 2: Direct audio download (no proxy)
    console.log('🎯 STRATEGY 2: Direct audio download...');
    try {
      const videoId = url.split('v=')[1]?.split('&')[0] || 'unknown';
      const audioFile = `/tmp/${sourceId}_${videoId}.m4a`;
      
      await execAsync(
        `yt-dlp -f "bestaudio[ext=m4a]" --output "${audioFile}" --no-warnings "${url}"`,
        { timeout: 120000 }
      );
      
      console.log('✅ Audio downloaded, transcribing...');
      
      // Transcribe with OpenAI
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
      
      const fs = require('fs');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });
      
      const transcript = {
        id: sourceId,
        sourceId,
        segments: transcription.segments || [],
        text: transcription.text,
        language: transcription.language || 'en',
        createdAt: new Date(),
        duration: transcription.segments?.[transcription.segments.length - 1]?.end || 0
      };
      
      await saveTranscript(sourceId, transcript);
      console.log('✅ Audio transcript saved');
      
      // Cleanup
      await execAsync(`rm -f "${audioFile}"`).catch(() => {});
      
      return NextResponse.json({ 
        success: true, 
        method: 'audio',
        segments: transcript.segments.length
      });
      
    } catch (error) {
      console.log('⚠️ Audio download failed:', error);
    }
    
    // Strategy 3: Try with different yt-dlp options
    console.log('🎯 STRATEGY 3: Alternative extraction...');
    try {
      const videoId = url.split('v=')[1]?.split('&')[0] || 'unknown';
      const audioFile = `/tmp/${sourceId}_${videoId}_alt.wav`;
      
      // Use different extraction method
      await execAsync(
        `yt-dlp -f "worst[ext=mp4]" --extract-audio --audio-format wav --output "${audioFile}" "${url}"`,
        { timeout: 180000 }
      );
      
      console.log('✅ Alternative extraction successful');
      
      // Transcribe
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY 
      });
      
      const fs = require('fs');
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFile),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment']
      });
      
      const transcript = {
        id: sourceId,
        sourceId,
        segments: transcription.segments || [],
        text: transcription.text,
        language: transcription.language || 'en',
        createdAt: new Date(),
        duration: transcription.segments?.[transcription.segments.length - 1]?.end || 0
      };
      
      await saveTranscript(sourceId, transcript);
      console.log('✅ Alternative transcript saved');
      
      // Cleanup
      await execAsync(`rm -f "${audioFile}"`).catch(() => {});
      
      return NextResponse.json({ 
        success: true, 
        method: 'alternative',
        segments: transcript.segments.length
      });
      
    } catch (error) {
      console.log('❌ All strategies failed');
    }
    
    return NextResponse.json({ 
      error: 'All transcription strategies failed',
      details: 'Video might be private, geo-blocked, or require special handling'
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ Fix transcription error:', error);
    return NextResponse.json({ 
      error: 'Transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function parseVTTToSegments(vttContent: string) {
  const lines = vttContent.split('\n');
  const segments = [];
  let currentSegment = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Time stamp line (e.g., "00:00:01.000 --> 00:00:05.000")
    if (line.includes('-->')) {
      const [startTime, endTime] = line.split('-->').map(t => t.trim());
      currentSegment = {
        start: parseVTTTime(startTime),
        end: parseVTTTime(endTime),
        text: ''
      };
    }
    // Text line
    else if (currentSegment && line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/)) {
      currentSegment.text += (currentSegment.text ? ' ' : '') + line;
      
      // If next line is empty or timestamp, save current segment
      if (i === lines.length - 1 || !lines[i + 1].trim() || lines[i + 1].includes('-->')) {
        if (currentSegment.text) {
          segments.push(currentSegment);
        }
        currentSegment = null;
      }
    }
  }
  
  return segments;
}

function parseVTTTime(timeString: string): number {
  const parts = timeString.split(':');
  const seconds = parseFloat(parts[parts.length - 1]);
  const minutes = parseInt(parts[parts.length - 2] || '0');
  const hours = parseInt(parts[parts.length - 3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}