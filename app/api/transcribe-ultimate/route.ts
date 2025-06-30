import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { writeFileSync, readFileSync, unlinkSync, existsSync, createReadStream } from 'fs';
import { saveTranscript } from '@/lib/database';
import { tmpdir } from 'os';
import path from 'path';

// Fix for OpenAI File upload in Node.js
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class extends Blob {
    constructor(chunks: BlobPart[], filename: string, options?: FilePropertyBag) {
      super(chunks, options);
      this.name = filename;
      this.lastModified = Date.now();
    }
    name: string;
    lastModified: number;
  };
}

const execAsync = promisify(exec);

// ULTIMATE TRANSCRIPTION - NO PROXY NEEDED, MAXIMUM COMPATIBILITY
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 ULTIMATE TRANSCRIPTION STARTING - NO PROXY APPROACH');
  console.log('Timestamp:', new Date().toISOString());
  
  let tempFiles: string[] = [];
  
  try {
    const { sourceId, url } = await request.json();
    
    if (!sourceId || !url) {
      return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
    }
    
    console.log('🎯 Target URL:', url);
    console.log('🆔 Session ID:', sourceId);
    
    const videoId = extractVideoId(url);
    const tempDir = tmpdir();
    const sessionId = `${sourceId}_${Date.now()}`;
    
    // **ULTIMATE STRATEGY 1: YOUTUBE API DIRECT**
    console.log('🎯 ULTIMATE STRATEGY 1: YouTube API with Google API key...');
    
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey) {
      try {
        console.log('🔑 Using YouTube Data API v3...');
        
        // Get video metadata
        const metadataResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${googleApiKey}&part=snippet,contentDetails`
        );
        
        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          
          if (metadataData.items?.[0]) {
            const videoInfo = metadataData.items[0];
            console.log('✅ Video metadata obtained:', videoInfo.snippet.title);
            
            // Try to get captions via API
            const captionsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${googleApiKey}&part=snippet`
            );
            
            if (captionsResponse.ok) {
              const captionsData = await captionsResponse.json();
              console.log('📝 Captions available:', captionsData.items?.length || 0);
              
              // If captions exist, try to download them
              if (captionsData.items?.length > 0) {
                for (const caption of captionsData.items) {
                  if (caption.snippet.language === 'en' || caption.snippet.language === 'en-US') {
                    try {
                      const captionDownloadResponse = await fetch(
                        `https://www.googleapis.com/youtube/v3/captions/${caption.id}?key=${googleApiKey}&tfmt=vtt`
                      );
                      
                      if (captionDownloadResponse.ok) {
                        const vttContent = await captionDownloadResponse.text();
                        console.log('✅ Downloaded captions via API');
                        
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
                          console.log('✅ API CAPTIONS TRANSCRIPT SAVED');
                          
                          return NextResponse.json({ 
                            success: true, 
                            method: 'youtube_api_captions',
                            segments: segments.length,
                            duration: transcript.duration,
                            processingTime: Math.round((Date.now() - startTime) / 1000)
                          });
                        }
                      }
                    } catch (error) {
                      console.log('⚠️ Caption download failed:', error);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('⚠️ YouTube API strategy failed:', error);
      }
    }
    
    // **ULTIMATE STRATEGY 2: MINIMAL YT-DLP WITHOUT PROXY**
    console.log('🎯 ULTIMATE STRATEGY 2: Minimal yt-dlp without proxy...');
    
    try {
      // Use absolute minimal yt-dlp command
      const minimalCmd = `cd "${tempDir}" && timeout 120 yt-dlp --no-check-certificate --ignore-errors --extract-audio --audio-format mp3 --audio-quality 9 --output "${sessionId}.%(ext)s" "${url}"`;
      
      console.log('🔧 Attempting minimal extraction...');
      await execAsync(minimalCmd, { timeout: 130000 });
      
      const audioFiles = await execAsync(`find "${tempDir}" -name "${sessionId}.*" -type f 2>/dev/null || true`);
      const audioFilePath = audioFiles.stdout.trim().split('\n')[0];
      
      if (audioFilePath && existsSync(audioFilePath)) {
        console.log('✅ Minimal extraction successful:', audioFilePath);
        return await transcribeWithOpenAI(audioFilePath, sourceId, tempFiles, startTime);
      }
      
    } catch (error) {
      console.log('⚠️ Minimal extraction failed:', error);
    }
    
    // **ULTIMATE STRATEGY 3: ALTERNATIVE TOOLS**
    console.log('🎯 ULTIMATE STRATEGY 3: Alternative extraction tools...');
    
    try {
      // Try with wget + ffmpeg if available
      const wgetCmd = `cd "${tempDir}" && timeout 60 wget -q --user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -O "${sessionId}.html" "${url}" 2>/dev/null || true`;
      
      await execAsync(wgetCmd, { timeout: 70000 });
      
      const htmlFile = path.join(tempDir, `${sessionId}.html`);
      if (existsSync(htmlFile)) {
        const htmlContent = readFileSync(htmlFile, 'utf8');
        
        // Look for direct audio/video URLs in the HTML
        const mediaUrlRegex = /"url":"([^"]*audio[^"]*\.m4a[^"]*)"/g;
        const matches = Array.from(htmlContent.matchAll(mediaUrlRegex));
        
        if (matches.length > 0) {
          const audioUrl = matches[0][1].replace(/\\u0026/g, '&');
          console.log('🔗 Found direct audio URL');
          
          // Download the audio file directly
          const directDownloadCmd = `cd "${tempDir}" && timeout 120 wget -q --user-agent="Mozilla/5.0" -O "${sessionId}.m4a" "${audioUrl}" 2>/dev/null || true`;
          
          await execAsync(directDownloadCmd, { timeout: 130000 });
          
          const directAudioFile = path.join(tempDir, `${sessionId}.m4a`);
          if (existsSync(directAudioFile)) {
            console.log('✅ Direct download successful');
            return await transcribeWithOpenAI(directAudioFile, sourceId, tempFiles, startTime);
          }
        }
      }
      
    } catch (error) {
      console.log('⚠️ Alternative tools failed:', error);
    }
    
    // **ULTIMATE STRATEGY 4: EMBEDDED IFRAME APPROACH**
    console.log('🎯 ULTIMATE STRATEGY 4: Embedded iframe extraction...');
    
    try {
      // Create a simple HTML page that embeds the video
      const embedHtml = `
<!DOCTYPE html>
<html>
<head><title>Video</title></head>
<body>
  <iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}?autoplay=0&controls=1" frameborder="0" allowfullscreen></iframe>
</body>
</html>`;
      
      const embedFile = path.join(tempDir, `${sessionId}_embed.html`);
      writeFileSync(embedFile, embedHtml);
      tempFiles.push(embedFile);
      
      // Try yt-dlp on the embed URL with minimal options
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      const embedCmd = `cd "${tempDir}" && timeout 90 yt-dlp --no-warnings --ignore-errors --extract-audio --audio-format wav --output "${sessionId}_embed.%(ext)s" "${embedUrl}" 2>/dev/null || true`;
      
      await execAsync(embedCmd, { timeout: 100000 });
      
      const embedFiles = await execAsync(`find "${tempDir}" -name "${sessionId}_embed.*" -type f 2>/dev/null || true`);
      const embedFilePath = embedFiles.stdout.trim().split('\n')[0];
      
      if (embedFilePath && existsSync(embedFilePath)) {
        console.log('✅ Embed extraction successful');
        return await transcribeWithOpenAI(embedFilePath, sourceId, tempFiles, startTime);
      }
      
    } catch (error) {
      console.log('⚠️ Embed approach failed:', error);
    }
    
    // **ULTIMATE STRATEGY 5: JAVASCRIPT EXTRACTION**
    console.log('🎯 ULTIMATE STRATEGY 5: JavaScript-based extraction...');
    
    try {
      // Create a Node.js script that uses different approach
      const jsScript = `
const https = require('https');
const fs = require('fs');

const url = '${url}';
const videoId = '${videoId}';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    // Look for player response
    const playerMatch = data.match(/var ytInitialPlayerResponse = ({.*?});/);
    if (playerMatch) {
      try {
        const playerData = JSON.parse(playerMatch[1]);
        const formats = playerData.streamingData?.adaptiveFormats || [];
        const audioFormat = formats.find(f => f.mimeType?.includes('audio/mp4'));
        if (audioFormat?.url) {
          console.log('AUDIO_URL:' + audioFormat.url);
        }
      } catch (e) {}
    }
  });
}).on('error', () => {});
`;
      
      const jsFile = path.join(tempDir, `${sessionId}_extract.js`);
      writeFileSync(jsFile, jsScript);
      tempFiles.push(jsFile);
      
      const jsOutput = await execAsync(`cd "${tempDir}" && timeout 30 node "${sessionId}_extract.js" 2>/dev/null || true`);
      
      const audioUrlMatch = jsOutput.stdout.match(/AUDIO_URL:(.+)/);
      if (audioUrlMatch) {
        const audioUrl = audioUrlMatch[1];
        console.log('🔗 JavaScript extraction found audio URL');
        
        const jsDownloadCmd = `cd "${tempDir}" && timeout 120 wget -q -O "${sessionId}_js.m4a" "${audioUrl}" 2>/dev/null || true`;
        await execAsync(jsDownloadCmd, { timeout: 130000 });
        
        const jsAudioFile = path.join(tempDir, `${sessionId}_js.m4a`);
        if (existsSync(jsAudioFile)) {
          console.log('✅ JavaScript extraction successful');
          return await transcribeWithOpenAI(jsAudioFile, sourceId, tempFiles, startTime);
        }
      }
      
    } catch (error) {
      console.log('⚠️ JavaScript approach failed:', error);
    }
    
    // **ALL ULTIMATE STRATEGIES FAILED**
    console.log('❌ ALL ULTIMATE STRATEGIES FAILED');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'Ultimate transcription strategies exhausted',
      details: 'This video may be heavily protected or require special access',
      attempted_methods: ['youtube_api', 'minimal_ytdlp', 'alternative_tools', 'embed_iframe', 'javascript_extraction'],
      suggestion: 'Try a different video or check if this specific video has restrictions',
      video_id: videoId,
      processing_time: Math.round((Date.now() - startTime) / 1000)
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ ULTIMATE TRANSCRIPTION ERROR:', error);
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'Ultimate transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function transcribeWithOpenAI(audioFilePath: string, sourceId: string, tempFiles: string[], startTime: number) {
  try {
    console.log('🤖 Transcribing with OpenAI Whisper...');
    
    // Check file size
    const stats = await execAsync(`stat -f%z "${audioFilePath}" 2>/dev/null || stat -c%s "${audioFilePath}"`);
    const fileSize = parseInt(stats.stdout.trim());
    console.log('📊 Audio file size:', Math.round(fileSize / 1024 / 1024), 'MB');
    
    if (fileSize > 25 * 1024 * 1024) {
      // Split large files
      console.log('📦 File too large, splitting...');
      const splitCmd = `cd "${path.dirname(audioFilePath)}" && ffmpeg -i "${audioFilePath}" -f segment -segment_time 600 -c copy "${audioFilePath}_part%03d.mp3" 2>/dev/null || true`;
      await execAsync(splitCmd, { timeout: 60000 });
      
      // Use first part
      const firstPart = `${audioFilePath}_part000.mp3`;
      if (existsSync(firstPart)) {
        audioFilePath = firstPart;
        tempFiles.push(firstPart);
      }
    }
    
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000
    });
    
    // Create File object for OpenAI
    const audioBuffer = readFileSync(audioFilePath);
    const audioFile = new globalThis.File([audioBuffer], path.basename(audioFilePath), { 
      type: audioFilePath.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav' 
    });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'en'
    });
    
    console.log('✅ OpenAI transcription completed');
    
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
    console.log('✅ ULTIMATE AUDIO TRANSCRIPT SAVED');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      success: true, 
      method: 'ultimate_audio',
      segments: transcript.segments.length,
      duration: transcript.duration,
      processingTime: Math.round((Date.now() - startTime) / 1000)
    });
    
  } catch (error) {
    console.error('❌ OpenAI transcription failed:', error);
    throw error;
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
      const cleanText = line
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
      
      if (cleanText) {
        currentSegment.text += (currentSegment.text ? ' ' : '') + cleanText;
      }
      
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