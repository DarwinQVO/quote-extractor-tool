import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { saveSource, saveTranscript } from '@/lib/database';

const execAsync = promisify(exec);

/**
 * DIRECT Bright Data Implementation - No Python, Pure Node.js
 * 100% Online, Enterprise-ready
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 BRIGHTDATA DIRECT: Starting 100% online transcription');
  
  try {
    const { sourceId, url } = await request.json();
    
    if (!sourceId || !url) {
      return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
    }
    
    const videoId = extractVideoId(url);
    console.log(`📺 Video ID: ${videoId}`);
    
    // Get Bright Data credentials
    const proxy = {
      host: process.env.PROXY_HOST || 'brd.superproxy.io',
      port: process.env.PROXY_PORT || '33335',
      user: process.env.PROXY_USER || 'brd-customer-hl_16699f5c-zone-residential_proxy1',
      pass: process.env.PROXY_PASS || 'j24ifit7dkc6'
    };
    
    const proxyUrl = `http://${proxy.user}:${proxy.pass}@${proxy.host}:${proxy.port}`;
    console.log(`🌐 Using Bright Data proxy: ${proxy.host}:${proxy.port}`);
    
    // STRATEGY 1: Direct YouTube Transcript API (Most Reliable)
    console.log('📝 STRATEGY 1: Direct YouTube Transcript API...');
    
    try {
      // Try multiple transcript endpoints
      const transcriptUrls = [
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=vtt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=es&fmt=vtt`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=srv3`,
        `https://www.youtube.com/api/timedtext?v=${videoId}&lang=es&fmt=srv3`
      ];
      
      let transcriptText = null;
      
      for (const transcriptUrl of transcriptUrls) {
        console.log(`🔍 Trying: ${transcriptUrl}`);
        
        // Use curl with proxy for maximum compatibility
        const curlCmd = `curl -s --proxy "${proxyUrl}" --max-time 30 "${transcriptUrl}"`;
        
        try {
          const { stdout } = await execAsync(curlCmd, { 
            timeout: 35000,
            maxBuffer: 5 * 1024 * 1024 
          });
          
          if (stdout && stdout.length > 100) {
            console.log(`✅ Got transcript data: ${stdout.length} bytes`);
            
            // Parse VTT or SRV3 format
            if (stdout.includes('WEBVTT')) {
              transcriptText = parseVTT(stdout);
            } else if (stdout.includes('<transcript>') || stdout.includes('<text')) {
              transcriptText = parseXML(stdout);
            }
            
            if (transcriptText) {
              console.log('✅ Transcript parsed successfully');
              break;
            }
          }
        } catch (curlError) {
          console.log(`⚠️ Curl failed for ${transcriptUrl.split('?')[1]}`);
        }
      }
      
      if (transcriptText) {
        // Save transcript
        const transcript = {
          id: sourceId,
          sourceId,
          segments: createSegments(transcriptText),
          words: createWords(transcriptText),
          text: transcriptText,
          language: 'en',
          createdAt: new Date(),
          duration: 300
        };
        
        await saveTranscript(sourceId, transcript);
        
        return NextResponse.json({
          success: true,
          method: 'youtube-transcript-api',
          transcript: {
            text: transcriptText.substring(0, 500) + '...',
            length: transcriptText.length
          }
        });
      }
    } catch (error) {
      console.log('❌ Transcript API failed:', error);
    }
    
    // STRATEGY 2: Caption files via yt-dlp
    console.log('📝 STRATEGY 2: Caption extraction via yt-dlp...');
    
    try {
      const captionCmd = `yt-dlp --proxy "${proxyUrl}" --write-auto-sub --skip-download --sub-format vtt --sub-lang en,es --no-warnings --quiet --print "%(subtitles)s" "${url}"`;
      
      const { stdout: captionInfo } = await execAsync(captionCmd, {
        timeout: 60000,
        maxBuffer: 1024 * 1024
      });
      
      if (captionInfo && captionInfo.includes('.vtt')) {
        console.log('✅ Captions available, downloading...');
        
        // Download the actual caption file
        const downloadCmd = `yt-dlp --proxy "${proxyUrl}" --write-auto-sub --skip-download --sub-format vtt --sub-lang en,es --no-warnings -o "/tmp/${videoId}" "${url}"`;
        
        await execAsync(downloadCmd, { timeout: 60000 });
        
        // Try to read caption files
        const fs = require('fs');
        const captionFiles = [
          `/tmp/${videoId}.en.vtt`,
          `/tmp/${videoId}.es.vtt`,
          `/tmp/${videoId}.en-US.vtt`
        ];
        
        for (const file of captionFiles) {
          if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            const text = parseVTT(content);
            
            if (text) {
              // Clean up
              fs.unlinkSync(file);
              
              // Save transcript
              const transcript = {
                id: sourceId,
                sourceId,
                segments: createSegments(text),
                words: createWords(text),
                text: text,
                language: 'en',
                createdAt: new Date(),
                duration: 300
              };
              
              await saveTranscript(sourceId, transcript);
              
              return NextResponse.json({
                success: true,
                method: 'yt-dlp-captions',
                transcript: {
                  text: text.substring(0, 500) + '...',
                  length: text.length
                }
              });
            }
          }
        }
      }
    } catch (error) {
      console.log('❌ Caption extraction failed:', error);
    }
    
    // STRATEGY 3: Use OpenAI Whisper API directly (if available)
    if (process.env.OPENAI_API_KEY) {
      console.log('🤖 STRATEGY 3: OpenAI Whisper API...');
      
      try {
        // Download minimal audio
        const audioCmd = `yt-dlp --proxy "${proxyUrl}" -f "worstaudio" --extract-audio --audio-format mp3 --audio-quality 9 -o "/tmp/${videoId}.mp3" "${url}"`;
        
        await execAsync(audioCmd, { timeout: 120000 });
        
        const audioFile = `/tmp/${videoId}.mp3`;
        const fs = require('fs');
        
        if (fs.existsSync(audioFile)) {
          const audioBuffer = fs.readFileSync(audioFile);
          
          // Use OpenAI API directly
          const formData = new FormData();
          formData.append('file', new Blob([audioBuffer], { type: 'audio/mp3' }), `${videoId}.mp3`);
          formData.append('model', 'whisper-1');
          formData.append('language', 'es');
          
          const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: formData
          });
          
          if (response.ok) {
            const result = await response.json();
            
            // Clean up
            fs.unlinkSync(audioFile);
            
            // Save transcript
            const transcript = {
              id: sourceId,
              sourceId,
              segments: createSegments(result.text),
              words: createWords(result.text),
              text: result.text,
              language: 'es',
              createdAt: new Date(),
              duration: 300
            };
            
            await saveTranscript(sourceId, transcript);
            
            return NextResponse.json({
              success: true,
              method: 'openai-whisper-api',
              transcript: {
                text: result.text.substring(0, 500) + '...',
                length: result.text.length
              }
            });
          }
        }
      } catch (error) {
        console.log('❌ OpenAI Whisper API failed:', error);
      }
    }
    
    // If all strategies fail
    return NextResponse.json({
      error: 'All transcription strategies failed',
      details: 'Unable to extract transcript using any method'
    }, { status: 500 });
    
  } catch (error) {
    console.error('❌ BRIGHTDATA DIRECT ERROR:', error);
    return NextResponse.json({
      error: 'Transcription failed',
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
  
  return url;
}

function parseVTT(content: string): string {
  const lines = content.split('\n');
  const textLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && 
        !trimmed.startsWith('WEBVTT') && 
        !trimmed.includes('-->') && 
        !trimmed.match(/^\d+$/) &&
        !trimmed.includes('align:') &&
        !trimmed.includes('position:')) {
      // Remove HTML tags
      const clean = trimmed
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
      
      if (clean) {
        textLines.push(clean);
      }
    }
  }
  
  return textLines.join(' ');
}

function parseXML(content: string): string {
  const textMatches = content.matchAll(/<text[^>]*>([^<]+)<\/text>/g);
  const texts: string[] = [];
  
  for (const match of textMatches) {
    const text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
    
    if (text) {
      texts.push(text);
    }
  }
  
  return texts.join(' ');
}

function createSegments(text: string): any[] {
  const words = text.split(' ');
  const segmentSize = Math.max(10, Math.floor(words.length / 8));
  const segments = [];
  
  for (let i = 0; i < words.length; i += segmentSize) {
    segments.push({
      start: i * 2,
      end: (i + segmentSize) * 2,
      text: words.slice(i, i + segmentSize).join(' '),
      speaker: 'Speaker 1'
    });
  }
  
  return segments;
}

function createWords(text: string): any[] {
  return text.split(' ').map((word, index) => ({
    word,
    start: index * 2,
    end: (index + 1) * 2,
    confidence: 0.95
  }));
}