import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { writeFileSync, readFileSync, unlinkSync, existsSync, statSync } from 'fs';
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

// FINAL TRANSCRIPTION - ENTERPRISE LEVEL SOLUTION
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 FINAL TRANSCRIPTION - ENTERPRISE SOLUTION STARTING');
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
    
    // **STRATEGY 1: YOUTUBE API WITH GOOGLE KEY**
    console.log('🔑 STRATEGY 1: Official YouTube API...');
    
    const googleApiKey = process.env.GOOGLE_API_KEY;
    if (googleApiKey) {
      try {
        const metadataResponse = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${googleApiKey}&part=snippet,contentDetails`
        );
        
        if (metadataResponse.ok) {
          const metadataData = await metadataResponse.json();
          
          if (metadataData.items?.[0]) {
            console.log('✅ Video metadata obtained via API');
            
            // Get captions via API
            const captionsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${googleApiKey}&part=snippet`
            );
            
            if (captionsResponse.ok) {
              const captionsData = await captionsResponse.json();
              
              if (captionsData.items?.length > 0) {
                for (const caption of captionsData.items) {
                  if (caption.snippet.language.startsWith('en')) {
                    try {
                      const captionDownloadResponse = await fetch(
                        `https://www.googleapis.com/youtube/v3/captions/${caption.id}?key=${googleApiKey}&tfmt=vtt`
                      );
                      
                      if (captionDownloadResponse.ok) {
                        const vttContent = await captionDownloadResponse.text();
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
                          console.log('✅ YOUTUBE API TRANSCRIPT SAVED');
                          
                          return NextResponse.json({ 
                            success: true, 
                            method: 'youtube_api',
                            segments: segments.length,
                            duration: transcript.duration,
                            processingTime: Math.round((Date.now() - startTime) / 1000)
                          });
                        }
                      }
                    } catch (error) {
                      console.log('⚠️ Caption API download failed:', error);
                    }
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.log('⚠️ YouTube API failed:', error);
      }
    }
    
    // **STRATEGY 2: ADVANCED YT-DLP WITH MULTIPLE CONFIGS**
    console.log('🛠️ STRATEGY 2: Advanced yt-dlp configurations...');
    
    const ytdlpConfigs = [
      // Config 1: Latest format
      `--format "bestaudio[ext=m4a]/bestaudio[ext=mp3]/bestaudio" --extract-audio --audio-format mp3`,
      
      // Config 2: Mobile bypass
      `--user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X)" --format "worst[ext=mp4]" --extract-audio --audio-format wav`,
      
      // Config 3: Old school
      `--format "18/worst" --extract-audio --audio-format mp3 --audio-quality 5`,
      
      // Config 4: Direct stream
      `--format "140/bestaudio" --extract-audio --audio-format m4a`,
      
      // Config 5: Minimal
      `--format "worst" --extract-audio --audio-format wav --audio-quality 9`
    ];
    
    for (let i = 0; i < ytdlpConfigs.length; i++) {
      try {
        const config = ytdlpConfigs[i];
        const outputFile = `${sessionId}_config${i}`;
        
        console.log(`🔧 Trying config ${i + 1}/5...`);
        
        const ytdlpCmd = `cd "${tempDir}" && timeout 90 yt-dlp ${config} --output "${outputFile}.%(ext)s" --no-warnings --ignore-errors "${url}" 2>/dev/null || true`;
        
        await execAsync(ytdlpCmd, { timeout: 100000 });
        
        // Find created files
        const createdFiles = await execAsync(`find "${tempDir}" -name "${outputFile}.*" -type f -size +1k 2>/dev/null || true`);
        
        if (createdFiles.stdout.trim()) {
          const audioFile = createdFiles.stdout.trim().split('\n')[0];
          const stats = statSync(audioFile);
          
          console.log(`✅ Config ${i + 1} successful: ${Math.round(stats.size / 1024)}KB`);
          
          if (stats.size > 1024) { // At least 1KB
            tempFiles.push(audioFile);
            return await transcribeWithOpenAI(audioFile, sourceId, tempFiles, startTime, `ytdlp_config_${i + 1}`);
          }
        }
        
      } catch (error) {
        console.log(`⚠️ Config ${i + 1} failed:`, error);
      }
    }
    
    // **STRATEGY 3: FALLBACK CAPTION EXTRACTION**
    console.log('📝 STRATEGY 3: Fallback caption extraction...');
    
    try {
      // Try multiple caption extraction methods
      const captionMethods = [
        `--write-auto-sub --skip-download --sub-format vtt --sub-lang en`,
        `--write-sub --skip-download --sub-format srt --sub-lang en`,
        `--list-subs --write-auto-sub --skip-download --sub-format vtt`,
        `--write-auto-sub --write-sub --skip-download --sub-format vtt --all-subs`
      ];
      
      for (let i = 0; i < captionMethods.length; i++) {
        try {
          const method = captionMethods[i];
          const captionCmd = `cd "${tempDir}" && timeout 45 yt-dlp ${method} --output "${sessionId}_captions${i}" --no-warnings "${url}" 2>/dev/null || true`;
          
          await execAsync(captionCmd, { timeout: 50000 });
          
          // Find VTT/SRT files
          const captionFiles = await execAsync(`find "${tempDir}" -name "*${sessionId}_captions${i}*" -name "*.vtt" -o -name "*.srt" 2>/dev/null || true`);
          
          if (captionFiles.stdout.trim()) {
            const captionFile = captionFiles.stdout.trim().split('\n')[0];
            tempFiles.push(captionFile);
            
            if (existsSync(captionFile)) {
              const captionContent = readFileSync(captionFile, 'utf8');
              console.log(`📊 Caption file ${i + 1} size:`, captionContent.length);
              
              let segments;
              if (captionFile.endsWith('.vtt')) {
                segments = parseVTTToSegments(captionContent);
              } else {
                segments = parseSRTToSegments(captionContent);
              }
              
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
                console.log(`✅ CAPTION METHOD ${i + 1} TRANSCRIPT SAVED`);
                
                cleanupFiles(tempFiles);
                
                return NextResponse.json({ 
                  success: true, 
                  method: `caption_method_${i + 1}`,
                  segments: segments.length,
                  duration: transcript.duration,
                  processingTime: Math.round((Date.now() - startTime) / 1000)
                });
              }
            }
          }
          
        } catch (error) {
          console.log(`⚠️ Caption method ${i + 1} failed:`, error);
        }
      }
      
    } catch (error) {
      console.log('⚠️ All caption methods failed:', error);
    }
    
    // **STRATEGY 4: ALTERNATIVE VIDEO URL FORMATS**
    console.log('🔄 STRATEGY 4: Alternative URL formats...');
    
    const alternativeUrls = [
      `https://www.youtube.com/watch?v=${videoId}`,
      `https://youtu.be/${videoId}`,
      `https://www.youtube.com/embed/${videoId}`,
      `https://m.youtube.com/watch?v=${videoId}`,
      `https://youtube.com/watch?v=${videoId}`
    ];
    
    for (let i = 0; i < alternativeUrls.length; i++) {
      try {
        const altUrl = alternativeUrls[i];
        console.log(`🔗 Trying alternative URL ${i + 1}: ${altUrl.substring(0, 40)}...`);
        
        const altCmd = `cd "${tempDir}" && timeout 60 yt-dlp --format "worst[ext=mp4]" --extract-audio --audio-format mp3 --output "${sessionId}_alt${i}.%(ext)s" --no-warnings --ignore-errors "${altUrl}" 2>/dev/null || true`;
        
        await execAsync(altCmd, { timeout: 70000 });
        
        const altFiles = await execAsync(`find "${tempDir}" -name "${sessionId}_alt${i}.*" -type f -size +1k 2>/dev/null || true`);
        
        if (altFiles.stdout.trim()) {
          const altFile = altFiles.stdout.trim().split('\n')[0];
          const stats = statSync(altFile);
          
          if (stats.size > 1024) {
            console.log(`✅ Alternative URL ${i + 1} successful: ${Math.round(stats.size / 1024)}KB`);
            tempFiles.push(altFile);
            return await transcribeWithOpenAI(altFile, sourceId, tempFiles, startTime, `alternative_url_${i + 1}`);
          }
        }
        
      } catch (error) {
        console.log(`⚠️ Alternative URL ${i + 1} failed:`, error);
      }
    }
    
    // **ALL STRATEGIES FAILED**
    console.log('❌ ALL ENTERPRISE STRATEGIES EXHAUSTED');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'All enterprise transcription strategies failed',
      details: 'This video appears to be heavily protected against automated access',
      attempted_strategies: [
        'youtube_api_official',
        'advanced_ytdlp_configs',
        'fallback_captions',
        'alternative_urls'
      ],
      video_id: videoId,
      processing_time: Math.round((Date.now() - startTime) / 1000),
      suggestion: 'This specific video may require manual intervention or may not be publicly accessible'
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ ENTERPRISE TRANSCRIPTION SYSTEM ERROR:', error);
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'Enterprise transcription system error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function transcribeWithOpenAI(audioFilePath: string, sourceId: string, tempFiles: string[], startTime: number, method: string) {
  try {
    console.log('🤖 OpenAI Whisper transcription starting...');
    console.log('📁 Audio file:', audioFilePath);
    
    const stats = statSync(audioFilePath);
    const fileSizeMB = stats.size / (1024 * 1024);
    console.log('📊 File size:', Math.round(fileSizeMB * 100) / 100, 'MB');
    
    if (stats.size < 1024) {
      throw new Error('Audio file too small (less than 1KB)');
    }
    
    if (fileSizeMB > 25) {
      console.log('📦 File too large, using first 10 minutes...');
      const croppedFile = audioFilePath.replace(/\.[^.]+$/, '_cropped.mp3');
      tempFiles.push(croppedFile);
      
      await execAsync(`ffmpeg -i "${audioFilePath}" -t 600 -c copy "${croppedFile}" 2>/dev/null || true`);
      
      if (existsSync(croppedFile)) {
        audioFilePath = croppedFile;
      }
    }
    
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000
    });
    
    // Create proper File object
    const audioBuffer = readFileSync(audioFilePath);
    const fileName = path.basename(audioFilePath);
    const mimeType = getMimeType(fileName);
    
    console.log('🔍 File details:', { fileName, mimeType, sizeMB: Math.round(audioBuffer.length / 1024 / 1024 * 100) / 100 });
    
    const audioFile = new globalThis.File([audioBuffer], fileName, { type: mimeType });
    
    console.log('🎯 Starting OpenAI transcription...');
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
      language: 'en'
    });
    
    console.log('✅ OpenAI transcription completed');
    console.log('📊 Segments generated:', transcription.segments?.length || 0);
    
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
    console.log('✅ ENTERPRISE TRANSCRIPT SAVED');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      success: true, 
      method: method,
      segments: transcript.segments.length,
      duration: transcript.duration,
      processingTime: Math.round((Date.now() - startTime) / 1000),
      fileSize: Math.round(fileSizeMB * 100) / 100
    });
    
  } catch (error) {
    console.error('❌ OpenAI transcription failed:', error);
    throw error;
  }
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  const mimeTypes: { [key: string]: string } = {
    '.mp3': 'audio/mpeg',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.flac': 'audio/flac'
  };
  return mimeTypes[ext] || 'audio/mpeg';
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

function parseSRTToSegments(srtContent: string) {
  const entries = srtContent.split(/\n\s*\n/);
  const segments = [];
  
  for (const entry of entries) {
    const lines = entry.trim().split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1];
      const textLines = lines.slice(2);
      
      if (timeLine.includes('-->')) {
        const [startTime, endTime] = timeLine.split('-->').map(t => t.trim());
        const text = textLines.join(' ').replace(/<[^>]*>/g, '').trim();
        
        if (text) {
          segments.push({
            start: parseSRTTime(startTime),
            end: parseSRTTime(endTime),
            text: text
          });
        }
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

function parseSRTTime(timeString: string): number {
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