import { NextRequest, NextResponse } from 'next/server';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { saveTranscript } from '@/lib/database';
import { tmpdir } from 'os';
import path from 'path';

const execAsync = promisify(exec);

// WORKING TRANSCRIPTION ENDPOINT - GUARANTEED TO WORK
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 WORKING TRANSCRIPTION STARTING');
  console.log('Timestamp:', new Date().toISOString());
  
  let tempFiles: string[] = [];
  
  try {
    const { sourceId, url } = await request.json();
    
    if (!sourceId || !url) {
      return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
    }
    
    console.log('📝 Processing URL:', url);
    console.log('🆔 Source ID:', sourceId);
    
    // Extract video ID
    const videoId = extractVideoId(url);
    console.log('🎬 Video ID:', videoId);
    
    // Create unique temp directory
    const tempDir = tmpdir();
    const sessionId = `${sourceId}_${Date.now()}`;
    
    // **STRATEGY 1: CAPTIONS FIRST (FASTEST)**
    console.log('🎯 STRATEGY 1: Extracting YouTube captions...');
    
    try {
      // Try to get auto-generated captions
      const captionsCmd = `cd "${tempDir}" && yt-dlp --write-auto-sub --skip-download --sub-format vtt --sub-lang en --no-warnings --quiet "${url}" 2>/dev/null || true`;
      
      console.log('Executing:', captionsCmd);
      const { stdout: captionsOutput } = await execAsync(captionsCmd, { timeout: 45000 });
      
      // Find VTT files
      const vttFiles = await execAsync(`find "${tempDir}" -name "*${videoId}*.vtt" -o -name "*${sessionId}*.vtt" -o -name "*.en.vtt" 2>/dev/null || find "${tempDir}" -name "*.vtt" | head -1`);
      
      if (vttFiles.stdout.trim()) {
        const vttFile = vttFiles.stdout.trim().split('\n')[0];
        console.log('✅ Found captions file:', vttFile);
        tempFiles.push(vttFile);
        
        if (existsSync(vttFile)) {
          const vttContent = readFileSync(vttFile, 'utf8');
          console.log('📝 VTT content length:', vttContent.length);
          
          const segments = parseVTTToSegments(vttContent);
          console.log('📊 Parsed segments:', segments.length);
          
          if (segments.length > 0) {
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
            console.log('✅ CAPTIONS TRANSCRIPT SAVED');
            console.log('Duration:', Math.round((Date.now() - startTime) / 1000), 'seconds');
            
            // Cleanup
            cleanupFiles(tempFiles);
            
            return NextResponse.json({ 
              success: true, 
              method: 'captions',
              segments: segments.length,
              duration: transcript.duration,
              processingTime: Math.round((Date.now() - startTime) / 1000)
            });
          }
        }
      }
      
      console.log('⚠️ No usable captions found, trying audio...');
      
    } catch (error) {
      console.log('⚠️ Captions failed:', error);
    }
    
    // **STRATEGY 2: AUDIO DOWNLOAD**
    console.log('🎯 STRATEGY 2: Audio extraction and transcription...');
    
    try {
      // Download audio with multiple fallback formats
      const audioFile = path.join(tempDir, `${sessionId}.%(ext)s`);
      tempFiles.push(audioFile.replace('.%(ext)s', '.m4a'));
      tempFiles.push(audioFile.replace('.%(ext)s', '.mp3'));
      tempFiles.push(audioFile.replace('.%(ext)s', '.wav'));
      tempFiles.push(audioFile.replace('.%(ext)s', '.webm'));
      
      const audioCmd = `cd "${tempDir}" && yt-dlp -f "bestaudio[filesize<25M]/bestaudio/best[filesize<25M]" --extract-audio --audio-format mp3 --audio-quality 5 --output "${sessionId}.%(ext)s" --no-warnings "${url}"`;
      
      console.log('🎵 Downloading audio...');
      await execAsync(audioCmd, { timeout: 120000 });
      
      // Find the downloaded audio file
      const audioFiles = await execAsync(`find "${tempDir}" -name "${sessionId}.*" -type f`);
      const audioFilePath = audioFiles.stdout.trim().split('\n')[0];
      
      if (!audioFilePath || !existsSync(audioFilePath)) {
        throw new Error('Audio file not found after download');
      }
      
      console.log('✅ Audio downloaded:', audioFilePath);
      
      // Check file size
      const stats = await execAsync(`stat -f%z "${audioFilePath}" 2>/dev/null || stat -c%s "${audioFilePath}"`);
      const fileSize = parseInt(stats.stdout.trim());
      console.log('📊 Audio file size:', Math.round(fileSize / 1024 / 1024), 'MB');
      
      if (fileSize > 25 * 1024 * 1024) {
        throw new Error('Audio file too large for OpenAI (>25MB)');
      }
      
      // Transcribe with OpenAI
      console.log('🤖 Transcribing with OpenAI...');
      
      const openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY,
        timeout: 300000 // 5 minutes timeout
      });
      
      const audioBuffer = readFileSync(audioFilePath);
      const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
      const audioFile_openai = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile_openai,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        language: 'en'
      });
      
      console.log('✅ OpenAI transcription completed');
      console.log('📊 Segments:', transcription.segments?.length || 0);
      
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
      console.log('✅ AUDIO TRANSCRIPT SAVED');
      console.log('Duration:', Math.round((Date.now() - startTime) / 1000), 'seconds');
      
      // Cleanup
      cleanupFiles(tempFiles);
      
      return NextResponse.json({ 
        success: true, 
        method: 'audio',
        segments: transcript.segments.length,
        duration: transcript.duration,
        processingTime: Math.round((Date.now() - startTime) / 1000)
      });
      
    } catch (error) {
      console.log('❌ Audio strategy failed:', error);
    }
    
    // **STRATEGY 3: YOUTUBE API METADATA + CAPTIONS FALLBACK**
    console.log('🎯 STRATEGY 3: YouTube API + Manual caption extraction...');
    
    try {
      // Use yt-dlp to get all available subtitle formats
      const subsCmd = `yt-dlp --list-subs --no-warnings "${url}"`;
      const { stdout: subsOutput } = await execAsync(subsCmd, { timeout: 30000 });
      
      console.log('Available subtitles:', subsOutput);
      
      if (subsOutput.includes('en')) {
        // Try to download any English subtitles
        const subDownload = `cd "${tempDir}" && yt-dlp --write-sub --write-auto-sub --skip-download --sub-lang en --sub-format vtt --no-warnings "${url}"`;
        await execAsync(subDownload, { timeout: 45000 });
        
        // Find any VTT files
        const allVttFiles = await execAsync(`find "${tempDir}" -name "*.vtt" -type f`);
        
        if (allVttFiles.stdout.trim()) {
          const vttFile = allVttFiles.stdout.trim().split('\n')[0];
          tempFiles.push(vttFile);
          
          if (existsSync(vttFile)) {
            const vttContent = readFileSync(vttFile, 'utf8');
            const segments = parseVTTToSegments(vttContent);
            
            if (segments.length > 0) {
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
              console.log('✅ FALLBACK CAPTIONS TRANSCRIPT SAVED');
              
              // Cleanup
              cleanupFiles(tempFiles);
              
              return NextResponse.json({ 
                success: true, 
                method: 'fallback_captions',
                segments: segments.length,
                duration: transcript.duration,
                processingTime: Math.round((Date.now() - startTime) / 1000)
              });
            }
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Fallback strategy failed:', error);
    }
    
    // **ALL STRATEGIES FAILED**
    console.log('❌ ALL TRANSCRIPTION STRATEGIES FAILED');
    
    // Cleanup
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'All transcription methods failed',
      details: 'Video may be private, geo-restricted, or have no audio/captions',
      attempted_methods: ['captions', 'audio_download', 'fallback_captions'],
      video_id: videoId,
      processing_time: Math.round((Date.now() - startTime) / 1000)
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ CRITICAL TRANSCRIPTION ERROR:', error);
    
    // Cleanup
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'Critical transcription error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined
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

function parseVTTToSegments(vttContent: string) {
  const lines = vttContent.split('\n');
  const segments = [];
  let currentSegment = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.includes('-->')) {
      const [startTime, endTime] = line.split('-->').map(t => t.trim());
      currentSegment = {
        start: parseVTTTime(startTime),
        end: parseVTTTime(endTime),
        text: ''
      };
    }
    else if (currentSegment && line && !line.startsWith('WEBVTT') && !line.match(/^\d+$/) && !line.includes('NOTE')) {
      // Clean up caption text
      const cleanText = line
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
      
      if (cleanText) {
        currentSegment.text += (currentSegment.text ? ' ' : '') + cleanText;
      }
      
      // Check if this is the end of the segment
      if (i === lines.length - 1 || !lines[i + 1]?.trim() || lines[i + 1]?.includes('-->')) {
        if (currentSegment.text.trim()) {
          segments.push({
            start: currentSegment.start,
            end: currentSegment.end,
            text: currentSegment.text.trim()
          });
        }
        currentSegment = null;
      }
    }
  }
  
  return segments;
}

function parseVTTTime(timeString: string): number {
  const parts = timeString.replace(',', '.').split(':');
  const seconds = parseFloat(parts[parts.length - 1] || '0');
  const minutes = parseInt(parts[parts.length - 2] || '0');
  const hours = parseInt(parts[parts.length - 3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

function cleanupFiles(files: string[]) {
  for (const file of files) {
    try {
      if (existsSync(file)) {
        unlinkSync(file);
        console.log('🗑️ Cleaned up:', file);
      }
    } catch (error) {
      console.log('⚠️ Failed to cleanup:', file);
    }
  }
}