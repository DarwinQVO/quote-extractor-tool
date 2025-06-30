import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs';
import { saveTranscript } from '@/lib/database';
import { tmpdir } from 'os';
import path from 'path';

const execAsync = promisify(exec);

// STEALTH TRANSCRIPTION - BYPASSES ALL YOUTUBE DETECTION
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🥷 STEALTH TRANSCRIPTION STARTING');
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
    
    // **STEALTH STRATEGY 1: RESIDENTIAL PROXY + COOKIES**
    console.log('🥷 STEALTH STRATEGY 1: Residential proxy with full evasion...');
    
    try {
      // Create cookies file to simulate logged-in user
      const cookiesFile = path.join(tempDir, `${sessionId}_cookies.txt`);
      tempFiles.push(cookiesFile);
      
      // Generate realistic cookies (basic format)
      const fakeCookies = `# Netscape HTTP Cookie File
.youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 86400}	CONSENT	YES+cb.20210328-17-p0.en+FX+667
.youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 86400}	VISITOR_INFO1_LIVE	${generateRandomString(22)}
.youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 86400}	YSC	${generateRandomString(16)}`;
      
      writeFileSync(cookiesFile, fakeCookies);
      
      // Ultra stealth extraction with residential proxy and full headers
      const proxy = process.env.YTDLP_PROXY || 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
      
      const stealthCmd = `cd "${tempDir}" && yt-dlp \\
        --proxy "${proxy}" \\
        --cookies "${cookiesFile}" \\
        --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \\
        --add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8" \\
        --add-header "Accept-Language:en-US,en;q=0.5" \\
        --add-header "Accept-Encoding:gzip, deflate, br" \\
        --add-header "DNT:1" \\
        --add-header "Connection:keep-alive" \\
        --add-header "Upgrade-Insecure-Requests:1" \\
        --add-header "Sec-Fetch-Dest:document" \\
        --add-header "Sec-Fetch-Mode:navigate" \\
        --add-header "Sec-Fetch-Site:none" \\
        --add-header "Sec-Fetch-User:?1" \\
        --sleep-interval 1 \\
        --max-sleep-interval 3 \\
        --extractor-args "youtube:player_client=web,mweb" \\
        -f "bestaudio[filesize<20M]/bestaudio[ext=m4a]/best[filesize<20M]" \\
        --extract-audio --audio-format mp3 --audio-quality 5 \\
        --output "${sessionId}.%(ext)s" \\
        --no-warnings \\
        "${url}"`;
      
      console.log('🌐 Using residential proxy with full stealth headers...');
      await execAsync(stealthCmd, { timeout: 180000 });
      
      // Find downloaded file
      const audioFiles = await execAsync(`find "${tempDir}" -name "${sessionId}.*" -type f`);
      const audioFilePath = audioFiles.stdout.trim().split('\n')[0];
      
      if (audioFilePath && existsSync(audioFilePath)) {
        console.log('✅ Stealth download successful:', audioFilePath);
        return await transcribeWithOpenAI(audioFilePath, sourceId, tempFiles, startTime);
      }
      
    } catch (error) {
      console.log('⚠️ Stealth strategy 1 failed:', error);
    }
    
    // **STEALTH STRATEGY 2: MOBILE CLIENT BYPASS**
    console.log('🥷 STEALTH STRATEGY 2: Mobile client bypass...');
    
    try {
      const mobileCmd = `cd "${tempDir}" && yt-dlp \\
        --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1" \\
        --add-header "Accept:text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" \\
        --add-header "Accept-Language:en-US,en;q=0.9" \\
        --extractor-args "youtube:player_client=mweb,ios" \\
        --sleep-interval 2 \\
        --max-sleep-interval 5 \\
        -f "bestaudio[filesize<20M]/worst[ext=mp4]" \\
        --extract-audio --audio-format mp3 \\
        --output "${sessionId}_mobile.%(ext)s" \\
        --no-warnings \\
        "${url}"`;
      
      console.log('📱 Trying mobile client bypass...');
      await execAsync(mobileCmd, { timeout: 120000 });
      
      const mobileFiles = await execAsync(`find "${tempDir}" -name "${sessionId}_mobile.*" -type f`);
      const mobileFilePath = mobileFiles.stdout.trim().split('\n')[0];
      
      if (mobileFilePath && existsSync(mobileFilePath)) {
        console.log('✅ Mobile bypass successful:', mobileFilePath);
        return await transcribeWithOpenAI(mobileFilePath, sourceId, tempFiles, startTime);
      }
      
    } catch (error) {
      console.log('⚠️ Mobile strategy failed:', error);
    }
    
    // **STEALTH STRATEGY 3: EMBEDDED PLAYER EXTRACTION**
    console.log('🥷 STEALTH STRATEGY 3: Embedded player extraction...');
    
    try {
      // Use embed URL which has different restrictions
      const embedUrl = `https://www.youtube.com/embed/${videoId}`;
      
      const embedCmd = `cd "${tempDir}" && yt-dlp \\
        --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \\
        --referer "https://www.example.com/" \\
        --add-header "X-Forwarded-For:${generateRandomIP()}" \\
        --extractor-args "youtube:player_client=embed" \\
        --sleep-interval 1 \\
        -f "worst[ext=mp4]/worst" \\
        --extract-audio --audio-format wav \\
        --output "${sessionId}_embed.%(ext)s" \\
        --no-warnings \\
        "${embedUrl}"`;
      
      console.log('🔗 Trying embedded player extraction...');
      await execAsync(embedCmd, { timeout: 120000 });
      
      const embedFiles = await execAsync(`find "${tempDir}" -name "${sessionId}_embed.*" -type f`);
      const embedFilePath = embedFiles.stdout.trim().split('\n')[0];
      
      if (embedFilePath && existsSync(embedFilePath)) {
        console.log('✅ Embed extraction successful:', embedFilePath);
        return await transcribeWithOpenAI(embedFilePath, sourceId, tempFiles, startTime);
      }
      
    } catch (error) {
      console.log('⚠️ Embed strategy failed:', error);
    }
    
    // **STEALTH STRATEGY 4: CAPTIONS WITH RESIDENTIAL PROXY**
    console.log('🥷 STEALTH STRATEGY 4: Stealth captions extraction...');
    
    try {
      const proxy = process.env.YTDLP_PROXY || 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
      
      const captionsCmd = `cd "${tempDir}" && yt-dlp \\
        --proxy "${proxy}" \\
        --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36" \\
        --write-auto-sub --write-sub \\
        --skip-download \\
        --sub-format vtt --sub-lang en \\
        --sleep-interval 2 \\
        --output "${sessionId}_captions" \\
        --no-warnings \\
        "${url}"`;
      
      console.log('📝 Extracting captions with residential proxy...');
      await execAsync(captionsCmd, { timeout: 60000 });
      
      const captionFiles = await execAsync(`find "${tempDir}" -name "*${sessionId}_captions*.vtt" -o -name "*${videoId}*.vtt" | head -1`);
      const captionFile = captionFiles.stdout.trim();
      
      if (captionFile && existsSync(captionFile)) {
        console.log('✅ Stealth captions found:', captionFile);
        tempFiles.push(captionFile);
        
        const vttContent = readFileSync(captionFile, 'utf8');
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
          console.log('✅ STEALTH CAPTIONS TRANSCRIPT SAVED');
          
          cleanupFiles(tempFiles);
          
          return NextResponse.json({ 
            success: true, 
            method: 'stealth_captions',
            segments: segments.length,
            duration: transcript.duration,
            processingTime: Math.round((Date.now() - startTime) / 1000)
          });
        }
      }
      
    } catch (error) {
      console.log('⚠️ Stealth captions failed:', error);
    }
    
    // **ALL STEALTH STRATEGIES FAILED**
    console.log('❌ ALL STEALTH STRATEGIES FAILED - YouTube detection too strong');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'YouTube bot detection bypassed all stealth methods',
      details: 'This video may require manual intervention or different access method',
      attempted_methods: ['residential_proxy', 'mobile_client', 'embedded_player', 'stealth_captions'],
      suggestion: 'Try a different video or check if video is public',
      video_id: videoId,
      processing_time: Math.round((Date.now() - startTime) / 1000)
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ STEALTH TRANSCRIPTION ERROR:', error);
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      error: 'Stealth transcription failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function transcribeWithOpenAI(audioFilePath: string, sourceId: string, tempFiles: string[], startTime: number) {
  try {
    console.log('🤖 Transcribing with OpenAI Whisper...');
    
    const openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 300000
    });
    
    const audioBuffer = readFileSync(audioFilePath);
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
    const audioFile = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });
    
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
    console.log('✅ STEALTH AUDIO TRANSCRIPT SAVED');
    
    cleanupFiles(tempFiles);
    
    return NextResponse.json({ 
      success: true, 
      method: 'stealth_audio',
      segments: transcript.segments.length,
      duration: transcript.duration,
      processingTime: Math.round((Date.now() - startTime) / 1000)
    });
    
  } catch (error) {
    console.error('❌ OpenAI transcription failed:', error);
    throw error;
  }
}

function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateRandomIP(): string {
  return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
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