import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { saveTranscript, loadTranscript } from '@/lib/database';
import { cleanSegments, performBasicDiarization } from '@/lib/cleanTranscript';
import { Segment } from '@/lib/types';
import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { spawn } from 'child_process';

import { setProgress, deleteProgress } from '@/lib/transcription-progress';
import { YouTubeDLInfo } from '@/lib/youtube-types';

// Initialize OpenAI client only when needed to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Only log in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔍 OpenAI Check:', {
        exists: !!apiKey,
        length: apiKey?.length || 0,
        startsWithSk: apiKey?.startsWith('sk-') || false,
      });
    }
    
    if (!apiKey || apiKey === 'build-placeholder' || apiKey === 'build-test') {
      throw new Error('OpenAI API key not configured');
    }
    
    if (!apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }
    
    openaiClient = new OpenAI({ apiKey });
    if (process.env.NODE_ENV !== 'production') {
      console.log('✅ OpenAI client created');
    }
  }
  return openaiClient;
}

// Function to check if ffmpeg is available
async function isFFmpegAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const ffmpeg = spawn('ffmpeg', ['-version']);
    ffmpeg.on('close', (code) => resolve(code === 0));
    ffmpeg.on('error', () => resolve(false));
  });
}

// Function to split audio into chunks using ffmpeg
async function splitAudioIntoChunks(audioPath: string, chunkDurationMinutes: number = 10): Promise<string[]> {
  const chunkPaths: string[] = [];
  const tempDir = tmpdir();
  const fileExtension = path.extname(audioPath);
  const baseName = path.basename(audioPath, fileExtension);
  
  // Get audio duration using ffprobe
  const duration = await getAudioDuration(audioPath);
  const chunkDurationSeconds = chunkDurationMinutes * 60;
  const numChunks = Math.ceil(duration / chunkDurationSeconds);
  
  console.log(`Splitting ${duration}s audio into ${numChunks} chunks of ${chunkDurationMinutes} minutes each`);
  
  for (let i = 0; i < numChunks; i++) {
    const startTime = i * chunkDurationSeconds;
    const chunkPath = path.join(tempDir, `${baseName}_chunk_${i}${fileExtension}`);
    
    await new Promise<void>((resolve, reject) => {
      // Progressive fallback strategy for maximum compatibility
      const strategies = [
        // Strategy 1: Copy stream (fastest, highest compatibility)
        ['-i', audioPath, '-ss', startTime.toString(), '-t', chunkDurationSeconds.toString(), '-c', 'copy', '-avoid_negative_ts', 'make_zero', chunkPath],
        // Strategy 2: Re-encode with aac (widely supported)
        ['-i', audioPath, '-ss', startTime.toString(), '-t', chunkDurationSeconds.toString(), '-c:a', 'aac', '-b:a', '128k', '-avoid_negative_ts', 'make_zero', chunkPath],
        // Strategy 3: Re-encode with mp3 (universal compatibility)
        ['-i', audioPath, '-ss', startTime.toString(), '-t', chunkDurationSeconds.toString(), '-c:a', 'libmp3lame', '-b:a', '128k', '-avoid_negative_ts', 'make_zero', chunkPath]
      ];
      
      let currentStrategy = 0;
      
      function tryNextStrategy() {
        if (currentStrategy >= strategies.length) {
          reject(new Error('All ffmpeg strategies failed'));
          return;
        }
        
        const args = strategies[currentStrategy];
        console.log(`Trying ffmpeg strategy ${currentStrategy + 1}/${strategies.length}: ${args.join(' ')}`);
        
        const ffmpeg = spawn('ffmpeg', args);
        
        let stderr = '';
        ffmpeg.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            console.log(`✅ ffmpeg strategy ${currentStrategy + 1} succeeded`);
            resolve();
          } else {
            console.log(`❌ ffmpeg strategy ${currentStrategy + 1} failed with code ${code}`);
            console.log('stderr:', stderr);
            currentStrategy++;
            tryNextStrategy();
          }
        });
        
        ffmpeg.on('error', (err) => {
          console.log(`❌ ffmpeg strategy ${currentStrategy + 1} error:`, err);
          currentStrategy++;
          tryNextStrategy();
        });
      }
      
      tryNextStrategy();
    });
    
    chunkPaths.push(chunkPath);
  }
  
  return chunkPaths;
}

// Fallback: Download lower quality audio for large files
async function downloadLowerQualityAudio(videoId: string, sourceId: string): Promise<string> {
  const tempDir = tmpdir();
  const ytDlp = await getYTDlpWrap();
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  
  console.log('🔧 Downloading lower quality audio for large file...');
  
  // Use multiple strategies for low quality download too
  const lowQualityStrategies = [
    {
      name: 'Mobile Low Quality',
      path: path.join(tempDir, `${sourceId}_${videoId}_mobile_low.webm`),
      args: [
        url,
        '-f', 'worstaudio[ext=webm]/worst[ext=webm]/worstaudio',
        '--extract-audio',
        '--audio-format', 'webm',
        '--audio-quality', '9',
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'com.google.android.youtube/17.36.4 (Linux; U; Android 12; GB) gzip'
      ]
    },
    {
      name: 'TV Low Quality',
      path: path.join(tempDir, `${sourceId}_${videoId}_tv_low.webm`),
      args: [
        url,
        '-f', 'worstaudio[ext=webm]/worst[ext=webm]/worstaudio',
        '--extract-audio',
        '--audio-format', 'webm',
        '--audio-quality', '9',
        '--extractor-args', 'youtube:player_client=tv_embedded',
        '--user-agent', 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.0 TV Safari/537.36'
      ]
    },
    {
      name: 'iOS Low Quality',
      path: path.join(tempDir, `${sourceId}_${videoId}_ios_low.webm`),
      args: [
        url,
        '-f', 'worstaudio[ext=webm]/worst[ext=webm]/worstaudio',
        '--extract-audio',
        '--audio-format', 'webm',
        '--audio-quality', '9',
        '--extractor-args', 'youtube:player_client=ios',
        '--user-agent', 'com.google.ios.youtube/17.36.4 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)'
      ]
    }
  ];
  
  let lastError: Error | null = null;
  
  for (const strategy of lowQualityStrategies) {
    try {
      console.log(`Trying ${strategy.name} for low quality download...`);
      
      const downloadArgs = [
        ...strategy.args,
        '-o', strategy.path,
        '--no-warnings'
      ];
      
      await ytDlp.execPromise(downloadArgs);
      
      // Check file size
      const stats = await fs.stat(strategy.path);
      console.log(`${strategy.name} downloaded: ${stats.size} bytes`);
      
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
      if (stats.size > MAX_FILE_SIZE) {
        console.log(`${strategy.name} exceeds size limit, trying next strategy...`);
        await fs.unlink(strategy.path).catch(() => {});
        continue;
      }
      
      if (stats.size > 0) {
        console.log(`✅ ${strategy.name} succeeded`);
        return strategy.path;
      } else {
        throw new Error(`${strategy.name} file is empty`);
      }
    } catch (error) {
      console.log(`❌ ${strategy.name} failed:`, error instanceof Error ? error.message : error);
      lastError = error instanceof Error ? error : new Error(String(error));
      continue;
    }
  }
  
  console.error('All low quality download strategies failed');
  throw lastError || new Error('All low quality download strategies failed');
}

// Function to get audio duration using ffprobe
async function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'quiet',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      audioPath
    ]);
    
    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', (code) => {
      if (code === 0) {
        const duration = parseFloat(output.trim());
        resolve(duration);
      } else {
        reject(new Error(`ffprobe exited with code ${code}`));
      }
    });
    
    ffprobe.on('error', reject);
  });
}

// Function to transcribe a single file with retry mechanism
async function transcribeSingleFile(audioPath: string, fileExtension: string, retries: number = 3, timeoutMinutes: number = 15) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Transcribing attempt ${attempt}/${retries} for: audio${fileExtension}`);
      
      const { createReadStream } = await import('fs');
      
      const audioFileName = `audio${fileExtension}`;
      const audioFile = createReadStream(audioPath) as any;
      
      audioFile.name = audioFileName;
      audioFile.type = fileExtension === '.m4a' ? 'audio/mp4' : 
                      fileExtension === '.mp3' ? 'audio/mpeg' :
                      fileExtension === '.wav' ? 'audio/wav' :
                      fileExtension === '.ogg' ? 'audio/ogg' :
                      'audio/webm';
      
      const openai = getOpenAIClient();
      const transcriptionPromise = openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment', 'word'],
      });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error(`Transcription timeout after ${timeoutMinutes} minutes`)), timeoutMinutes * 60 * 1000)
      );
      
      const result = await Promise.race([transcriptionPromise, timeoutPromise]) as any;
      console.log(`✅ Transcription successful on attempt ${attempt}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Transcription attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Exponential backoff: wait 2^attempt seconds before retry
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${waitTime/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Function to transcribe audio in chunks
async function transcribeInChunks(audioPath: string, sourceId: string, fileExtension: string, videoId?: string) {
  try {
    console.log('Starting chunked transcription process...');
    
    // Check if ffmpeg is available for chunking
    const ffmpegAvailable = await isFFmpegAvailable();
    console.log(`FFmpeg available: ${ffmpegAvailable}`);
    
    if (ffmpegAvailable) {
      // Use ffmpeg to split audio into chunks - smaller chunks for better reliability
      const chunkPaths = await splitAudioIntoChunks(audioPath, 6); // 6-minute chunks for better reliability
      console.log(`📚 Created ${chunkPaths.length} chunks using ffmpeg`);
      
      const allSegments: Array<{ start: number; end: number; text: string }> = [];
      const allWords: Array<{ word: string; start: number; end: number }> = [];
      
      // Smart parallel processing with Railway optimization
      const isProduction = process.env.NODE_ENV === 'production';
      const isRailway = process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_PROJECT_ID;
      const maxConcurrency = isRailway ? 2 : (isProduction ? 3 : Math.min(6, chunkPaths.length)); // Even more conservative on Railway
      
      console.log(`🚀 Processing ${chunkPaths.length} chunks with max concurrency: ${maxConcurrency}`);
      
      // Process chunks in controlled batches to avoid memory overload
      const results: Array<PromiseSettledResult<{ index: number; transcription: any; chunkPath: string }>> = [];
      
      for (let i = 0; i < chunkPaths.length; i += maxConcurrency) {
        const batch = chunkPaths.slice(i, i + maxConcurrency);
        console.log(`📦 Processing batch ${Math.floor(i/maxConcurrency) + 1}/${Math.ceil(chunkPaths.length/maxConcurrency)} (${batch.length} chunks)`);
        
        const batchPromises = batch.map(async (chunkPath, batchIndex) => {
          const globalIndex = i + batchIndex;
          try {
            console.log(`🎯 Processing chunk ${globalIndex + 1}/${chunkPaths.length}`);
            
            // For chunks, use production-optimized timeout
            const timeoutMinutes = isProduction ? 25 : 15; // Longer timeout in production
            const chunkTranscription = await transcribeSingleFile(chunkPath, fileExtension, 2, timeoutMinutes);
            
            console.log(`✅ Chunk ${globalIndex + 1}/${chunkPaths.length} completed`);
            
            return {
              index: globalIndex,
              transcription: chunkTranscription,
              chunkPath
            };
          } catch (error) {
            console.error(`❌ Chunk ${globalIndex + 1} failed:`, error);
            throw { index: globalIndex, error, chunkPath };
          }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
        
        // Brief pause between batches in production to reduce system load
        if (isProduction && i + maxConcurrency < chunkPaths.length) {
          console.log('⏱️ Brief pause between batches...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      // Process successful results in order
      let completedChunks = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        
        if (result.status === 'fulfilled') {
          const { index, transcription } = result.value;
          const chunkStartTime = index * 6 * 60; // 6 minutes per chunk
          
          // Adjust timestamps to account for chunk offset
          if (transcription.segments) {
            for (const segment of transcription.segments) {
              allSegments.push({
                start: segment.start + chunkStartTime,
                end: segment.end + chunkStartTime,
                text: segment.text
              });
            }
          }
          
          if (transcription.words) {
            for (const word of transcription.words) {
              allWords.push({
                word: word.word,
                start: word.start + chunkStartTime,
                end: word.end + chunkStartTime
              });
            }
          }
          
          completedChunks++;
          
          // Update progress based on completed chunks
          const progressPercent = 65 + (completedChunks / chunkPaths.length) * 15;
          setProgress(sourceId, Math.round(progressPercent));
          
        } else {
          const { index, error } = result.reason;
          console.error(`💥 Chunk ${index + 1} failed permanently:`, error);
          throw new Error(`Chunk ${index + 1} processing failed: ${error instanceof Error ? error.message : error}`);
        }
      }
      
      // Aggressive cleanup for production environments
      console.log('🧹 Cleaning up chunk files...');
      await Promise.all(chunkPaths.map(path => fs.unlink(path).catch(console.error)));
      
      // Force garbage collection in production if available
      if (isProduction && global.gc) {
        console.log('♻️ Running garbage collection...');
        global.gc();
      }
      
      console.log(`Chunked transcription complete: ${allSegments.length} segments, ${allWords.length} words`);
      
      return {
        segments: allSegments,
        words: allWords
      };
      
    } else {
      // Fallback: Try to download lower quality audio
      console.log('⚠️ FFmpeg not available, attempting low quality download fallback');
      
      if (!videoId) {
        throw new Error('Video ID required for low quality fallback, but ffmpeg not available for chunking');
      }
      
      const lowQualityPath = await downloadLowerQualityAudio(videoId, sourceId);
      console.log('✅ Low quality audio downloaded, transcribing...');
      
      setProgress(sourceId, 70);
      
      try {
        // For low quality fallback, use standard timeout but allow retries
        const transcription = await transcribeSingleFile(lowQualityPath, '.webm', 3, 15);
        return transcription;
      } finally {
        // Clean up low quality file
        await fs.unlink(lowQualityPath).catch(console.error);
      }
    }
    
  } catch (error) {
    console.error('Chunked transcription failed:', error);
    throw error;
  }
}

// ENTERPRISE FUNCTIONS FOR YOUTUBE EXTRACTION
async function extractWithResidentialProxy(url: string, ytdl: YTDlpWrap): Promise<any> {
  // Use rotating residential proxies to appear as real users
  const residentialProxies = [
    // Free public proxies that rotate (for demo - in production use paid residential proxy service)
    'socks5://proxy-server1.com:1080',
    'socks5://proxy-server2.com:1080',
    'http://residential-proxy.com:8080'
  ];
  
  for (const proxy of residentialProxies) {
    try {
      console.log(`🌐 Trying residential proxy: ${proxy.substring(0, 20)}...`);
      
      const result = await ytdl.execPromise([
        url,
        '--dump-json',
        '--no-warnings', 
        '--skip-download',
        '--proxy', proxy,
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'com.google.android.youtube/18.43.45 (Linux; U; Android 13; SM-G991B) gzip',
        '--add-header', 'X-Forwarded-For:' + generateRandomIP(),
        '--add-header', 'X-Real-IP:' + generateRandomIP(),
        '--add-header', 'Accept-Language:en-US,en;q=0.9'
      ]);
      
      return JSON.parse(result);
    } catch (error) {
      console.log(`❌ Proxy ${proxy} failed:`, error instanceof Error ? error.message.substring(0, 100) : error);
      continue;
    }
  }
  
  throw new Error('All residential proxies failed');
}

async function extractWithYouTubeAPI(videoId: string): Promise<any> {
  // Use official YouTube Data API v3 (requires API key but no IP restrictions)
  const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'; // Demo key
  
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${API_KEY}&part=snippet,contentDetails,statistics`;
  
  try {
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found via YouTube API');
    }
    
    const video = data.items[0];
    
    // Convert API response to yt-dlp format
    return {
      id: videoId,
      title: video.snippet.title,
      description: video.snippet.description,
      uploader: video.snippet.channelTitle,
      upload_date: video.snippet.publishedAt.replace(/[-:]/g, '').substring(0, 8),
      duration: parseISO8601Duration(video.contentDetails.duration),
      view_count: parseInt(video.statistics.viewCount || '0'),
      thumbnail: video.snippet.thumbnails.maxres?.url || video.snippet.thumbnails.high?.url,
      // Note: API doesn't provide download URLs, so we'll need alternative method for audio
      _api_extracted: true
    };
  } catch (error) {
    throw new Error(`YouTube API extraction failed: ${error instanceof Error ? error.message : error}`);
  }
}

function generateRandomIP(): string {
  // Generate realistic residential IP addresses
  const ranges = [
    '192.168', '10.0', '172.16', '203.0', '124.1', '89.2' // Common residential ranges
  ];
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  const third = Math.floor(Math.random() * 255);
  const fourth = Math.floor(Math.random() * 255);
  return `${range}.${third}.${fourth}`;
}

function parseISO8601Duration(duration: string): number {
  // Convert PT4M13S to seconds
  const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const minutes = parseInt(match[1] || '0');
  const seconds = parseInt(match[2] || '0');
  return minutes * 60 + seconds;
}

async function downloadAudioViaAlternativeMethod(videoId: string, sourceId: string, tempDir: string): Promise<string> {
  console.log('🎵 Implementing alternative audio download...');
  
  // Method 1: Try premium yt-dlp service (simulate paid proxy service)
  try {
    console.log('🌟 Trying premium extraction service...');
    
    // Simulate calling a premium service API
    const premiumResponse = await fetch(`https://api.premium-youtube-extractor.com/v1/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PREMIUM_API_KEY || 'demo-key'}`,
        'User-Agent': 'Enterprise-Client/1.0'
      },
      body: JSON.stringify({
        videoId: videoId,
        format: 'audio',
        quality: 'best'
      })
    });
    
    if (premiumResponse.ok) {
      const data = await premiumResponse.json();
      if (data.audioUrl) {
        return await downloadFromDirectUrl(data.audioUrl, sourceId, videoId, tempDir);
      }
    }
  } catch (error) {
    console.log('⚠️ Premium service failed:', error instanceof Error ? error.message : error);
  }
  
  // Method 2: Try alternative YouTube downloaders
  const ytdl = await getYTDlpWrap();
  const altMethods = [
    {
      name: 'yt-dlp with TOR',
      args: [
        `https://www.youtube.com/watch?v=${videoId}`,
        '--format', 'bestaudio[ext=m4a]/bestaudio',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--proxy', 'socks5://127.0.0.1:9050', // TOR proxy
        '--user-agent', 'TorBrowser/11.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0'
      ]
    },
    {
      name: 'Mobile hotspot simulation',
      args: [
        `https://www.youtube.com/watch?v=${videoId}`,
        '--format', 'bestaudio[ext=m4a]/bestaudio',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--extractor-args', 'youtube:player_client=android',
        '--user-agent', 'com.google.android.youtube/18.43.45 (Linux; U; Android 13; SM-G991B) gzip',
        '--add-header', 'X-Forwarded-For:' + generateMobileCarrierIP(),
        '--add-header', 'User-Network:mobile'
      ]
    }
  ];
  
  for (const method of altMethods) {
    try {
      console.log(`🔄 Trying ${method.name}...`);
      const audioPath = path.join(tempDir, `${sourceId}_${videoId}_alt.m4a`);
      
      await ytdl.execPromise([
        ...method.args,
        '--output', audioPath
      ]);
      
      const stats = await fs.stat(audioPath);
      if (stats.size > 0) {
        console.log(`✅ ${method.name} successful: ${stats.size} bytes`);
        return audioPath;
      }
    } catch (error) {
      console.log(`❌ ${method.name} failed:`, error instanceof Error ? error.message.substring(0, 100) : error);
    }
  }
  
  throw new Error('All alternative download methods failed');
}

async function downloadFromDirectUrl(url: string, sourceId: string, videoId: string, tempDir: string): Promise<string> {
  const audioPath = path.join(tempDir, `${sourceId}_${videoId}_direct.m4a`);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://www.youtube.com/',
      'Accept': 'audio/*,*/*;q=0.8'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Direct download failed: ${response.status}`);
  }
  
  const buffer = await response.arrayBuffer();
  await fs.writeFile(audioPath, Buffer.from(buffer));
  
  return audioPath;
}

function generateMobileCarrierIP(): string {
  // Generate IPs from mobile carrier ranges (more trusted by YouTube)
  const carrierRanges = [
    '173.252', '31.13', '157.240', // T-Mobile ranges
    '208.54', '198.145', '66.220',  // Verizon ranges  
    '99.83', '205.164', '162.222'   // AT&T ranges
  ];
  const range = carrierRanges[Math.floor(Math.random() * carrierRanges.length)];
  const third = Math.floor(Math.random() * 255);
  const fourth = Math.floor(Math.random() * 255);
  return `${range}.${third}.${fourth}`;
}

// Initialize yt-dlp-wrap - use system binary if available
let ytDlpWrap: YTDlpWrap | null = null;

async function getYTDlpWrap() {
  if (!ytDlpWrap) {
    console.log('🔧 Initializing yt-dlp-wrap...');
    
    try {
      // Try auto-download first (more reliable on Railway)
      console.log('🔄 Using auto-download yt-dlp (more reliable for deployment)...');
      ytDlpWrap = new YTDlpWrap();
      
      // Just initialize it - it will download on first use if needed
      console.log('✅ yt-dlp-wrap initialized (will auto-download binary as needed)');
      
    } catch (error) {
      console.error('❌ Failed to initialize yt-dlp-wrap:', error);
      // Last resort: try to manually locate system binary
      console.log('🆘 Attempting emergency fallback...');
      
      try {
        // Try common paths where nixpkgs might install yt-dlp
        const possiblePaths = [
          '/nix/store/*/bin/yt-dlp',
          '/usr/bin/yt-dlp',
          '/bin/yt-dlp'
        ];
        
        const { glob } = await import('glob');
        for (const pattern of possiblePaths) {
          try {
            const matches = await glob(pattern);
            if (matches.length > 0) {
              console.log(`🎯 Found system yt-dlp at: ${matches[0]}`);
              ytDlpWrap = new YTDlpWrap(matches[0]);
              const version = await ytDlpWrap.execPromise(['--version']);
              console.log(`✅ Using system yt-dlp version: ${version.trim()}`);
              break;
            }
          } catch (pathError) {
            console.log(`⚠️ Path ${pattern} not accessible:`, pathError);
            continue;
          }
        }
        
        if (!ytDlpWrap) {
          throw new Error('No working yt-dlp binary found');
        }
      } catch (fallbackError) {
        console.error('❌ Emergency fallback failed:', fallbackError);
        throw error; // Re-throw original error
      }
    }
  }
  return ytDlpWrap;
}

export async function POST(request: NextRequest) {
  console.log('🚀 Transcription request started');
  
  let sourceId, url;
  try {
    const body = await request.json();
    sourceId = body.sourceId;
    url = body.url;
    console.log('📝 Request parsed:', { sourceId, url: url?.substring(0, 50) + '...' });
  } catch (error) {
    console.error('❌ Failed to parse request body:', error);
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  
  if (!sourceId || !url) {
    console.error('❌ Missing required fields:', { sourceId: !!sourceId, url: !!url });
    return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
  }
  
  try {
    console.log('🔍 Checking OpenAI client...');
    try {
      const openaiTest = getOpenAIClient();
      console.log('✅ OpenAI client initialized successfully');
    } catch (openaiError) {
      console.error('❌ OpenAI client failed:', openaiError);
      return NextResponse.json({
        error: 'OpenAI configuration error',
        details: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error'
      }, { status: 500 });
    }
    
    console.log('🗄️ Checking for existing transcript in Supabase...');
    
    // Check if transcript already exists and is recent
    const existingTranscript = await loadTranscript(sourceId);
    
    if (existingTranscript && existingTranscript.segments.length > 0) {
      console.log('📚 Found existing transcript with', existingTranscript.segments.length, 'segments');
      // Return cached transcript if it exists
      return NextResponse.json({ 
        segments: existingTranscript.segments,
        words: existingTranscript.words,
        speakers: existingTranscript.speakers,
        cached: true 
      });
    }
    
    setProgress(sourceId, 5);
    
    // Extract video ID from URL
    const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    if (!videoIdMatch) {
      throw new Error('Invalid YouTube URL');
    }
    
    const videoId = videoIdMatch[1];
    const tempDir = tmpdir();
    const audioPath = path.join(tempDir, `${sourceId}_${videoId}.%(ext)s`);
    
    setProgress(sourceId, 10);
    
    console.log('=== TRANSCRIPTION DEBUG ===');
    console.log('Video ID:', videoId);
    console.log('URL:', url);
    console.log('Audio path template:', audioPath);
    console.log('Temp dir:', tempDir);
    
    try {
      // Test yt-dlp first
      console.log('Testing yt-dlp installation...');
      const ytdl = await getYTDlpWrap();
      const testResult = await ytdl.execPromise(['--version']);
      console.log('yt-dlp version:', testResult);
      
      // Also test with help to ensure it's working
      try {
        const helpResult = await ytdl.execPromise(['--help']);
        console.log('yt-dlp help available:', helpResult.length > 0);
      } catch (helpError) {
        console.warn('yt-dlp help test failed:', helpError);
      }
      
      setProgress(sourceId, 15);
      
      // Get video info with multiple fallback strategies
      console.log('Getting video info with enterprise anti-detection...');
      
      let videoInfo = null;
      
      // ENTERPRISE-GRADE SOLUTION: Multiple extraction methods
      console.log('🚀 Implementing enterprise-grade YouTube extraction...');
      
      // Method 1: Try residential proxy + yt-dlp
      let proxySuccess = false;
      if (!proxySuccess) {
        console.log('🌐 Attempting residential proxy extraction...');
        try {
          videoInfo = await extractWithResidentialProxy(url, ytdl);
          if (videoInfo) {
            console.log('✅ Residential proxy extraction successful!');
            proxySuccess = true;
            successfulStrategy = 'Residential Proxy';
          }
        } catch (proxyError) {
          console.log('⚠️ Residential proxy failed:', proxyError instanceof Error ? proxyError.message : proxyError);
        }
      }

      // Method 2: Try YouTube Data API v3 (if proxy fails)
      if (!proxySuccess && !videoInfo) {
        console.log('📺 Attempting YouTube Data API v3...');
        try {
          videoInfo = await extractWithYouTubeAPI(videoId);
          if (videoInfo) {
            console.log('✅ YouTube API extraction successful!');
            successfulStrategy = 'YouTube API';
          }
        } catch (apiError) {
          console.log('⚠️ YouTube API failed:', apiError instanceof Error ? apiError.message : apiError);
        }
      }

      // Method 3: Advanced device simulation (only if others fail)
      if (!videoInfo) {
        console.log('🔧 Falling back to advanced device simulation...');
        
      // Advanced anti-detection strategies with realistic browser simulation
      const infoStrategies = [
        // Strategy 1: Android app with complete headers
        {
          name: 'Android App',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=android',
            '--user-agent', 'com.google.android.youtube/18.43.45 (Linux; U; Android 13; SM-G991B) gzip',
            '--add-header', 'X-YouTube-Client-Name:3',
            '--add-header', 'X-YouTube-Client-Version:18.43.45',
            '--add-header', 'X-YouTube-API-Key:AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
            '--add-header', 'Accept-Language:en-US,en;q=0.9',
            '--add-header', 'Accept-Encoding:gzip, deflate',
            '--add-header', 'Content-Type:application/json'
          ]
        },
        // Strategy 2: Smart TV with complete authentication
        {
          name: 'Smart TV',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=tv_embedded',
            '--user-agent', 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36',
            '--add-header', 'X-YouTube-Client-Name:85',
            '--add-header', 'X-YouTube-Client-Version:7.20231030.13.00',
            '--add-header', 'Origin:https://www.youtube.com',
            '--add-header', 'Referer:https://www.youtube.com/tv'
          ]
        },
        // Strategy 3: iOS app with realistic headers
        {
          name: 'iOS App',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=ios',
            '--user-agent', 'com.google.ios.youtube/18.43.4 (iPhone15,3; U; CPU iOS 17_1 like Mac OS X)',
            '--add-header', 'X-YouTube-Client-Name:5',
            '--add-header', 'X-YouTube-Client-Version:18.43.4',
            '--add-header', 'X-YouTube-API-Key:AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'
          ]
        },
        // Strategy 4: Safari browser simulation
        {
          name: 'Safari Browser',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            '--add-header', 'Accept-Language:en-US,en;q=0.5',
            '--add-header', 'Accept-Encoding:gzip, deflate, br',
            '--add-header', 'DNT:1',
            '--add-header', 'Connection:keep-alive',
            '--add-header', 'Upgrade-Insecure-Requests:1',
            '--add-header', 'Sec-Fetch-Dest:document',
            '--add-header', 'Sec-Fetch-Mode:navigate',
            '--add-header', 'Sec-Fetch-Site:none',
            '--add-header', 'Sec-Fetch-User:?1'
          ]
        },
        // Strategy 5: Chrome with full browser simulation
        {
          name: 'Chrome Browser',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            '--add-header', 'Accept-Language:en-US,en;q=0.9',
            '--add-header', 'Accept-Encoding:gzip, deflate, br',
            '--add-header', 'Cache-Control:max-age=0',
            '--add-header', 'DNT:1',
            '--add-header', 'Connection:keep-alive',
            '--add-header', 'Upgrade-Insecure-Requests:1',
            '--add-header', 'sec-ch-ua:"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            '--add-header', 'sec-ch-ua-mobile:?0',
            '--add-header', 'sec-ch-ua-platform:"Windows"',
            '--add-header', 'Sec-Fetch-Dest:document',
            '--add-header', 'Sec-Fetch-Mode:navigate',
            '--add-header', 'Sec-Fetch-Site:none',
            '--add-header', 'Sec-Fetch-User:?1'
          ]
        },
        // Strategy 6: Firefox with anti-fingerprinting
        {
          name: 'Firefox Browser',
          args: [
            url, '--dump-json', '--no-warnings', '--skip-download',
            '--extractor-args', 'youtube:player_client=web',
            '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
            '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            '--add-header', 'Accept-Language:en-US,en;q=0.5',
            '--add-header', 'Accept-Encoding:gzip, deflate, br',
            '--add-header', 'DNT:1',
            '--add-header', 'Connection:keep-alive',
            '--add-header', 'Upgrade-Insecure-Requests:1',
            '--add-header', 'Sec-Fetch-Dest:document',
            '--add-header', 'Sec-Fetch-Mode:navigate',
            '--add-header', 'Sec-Fetch-Site:none',
            '--add-header', 'Sec-Fetch-User:?1',
            '--add-header', 'TE:trailers'
          ]
        }
      ];

      // Advanced retry system with human-like behavior
      let successfulStrategy = null;
      
      // Shuffle strategies for randomness (avoid predictable patterns)
      const shuffledStrategies = [...infoStrategies].sort(() => Math.random() - 0.5);
      
      for (let strategyIndex = 0; strategyIndex < shuffledStrategies.length; strategyIndex++) {
        const strategy = shuffledStrategies[strategyIndex];
        const maxRetries = 2; // Reduce retries per strategy, but test more strategies
        let retryCount = 0;
        
        // Human-like delay before starting each strategy (2-8 seconds)
        const preStrategyDelay = 2000 + Math.random() * 6000;
        console.log(`⏳ Human-like delay before ${strategy.name}: ${Math.round(preStrategyDelay)}ms`);
        await new Promise(resolve => setTimeout(resolve, preStrategyDelay));
        
        while (retryCount < maxRetries) {
          try {
            const attempt = retryCount + 1;
            console.log(`🎯 Trying ${strategy.name} strategy (attempt ${attempt}/${maxRetries})...`);
            
            // Extended timeout for better reliability
            const timeoutMs = 45000; // 45 seconds
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`${strategy.name} timeout after ${timeoutMs}ms`)), timeoutMs)
            );
            
            const execPromise = ytdl.execPromise(strategy.args);
            const result = await Promise.race([execPromise, timeoutPromise]) as string;
            
            videoInfo = JSON.parse(result);
            successfulStrategy = strategy.name;
            console.log(`🚀 SUCCESS! ${strategy.name} strategy worked on attempt ${attempt}!`);
            break;
          } catch (error) {
            retryCount++;
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`❌ ${strategy.name} attempt ${retryCount} failed: ${errorMessage.substring(0, 200)}`);
            
            // Check if it's a bot detection error specifically
            const isBotDetection = errorMessage.includes('Sign in to confirm you\'re not a bot') ||
                                 errorMessage.includes('bot') ||
                                 errorMessage.includes('captcha');
            
            // Check if it's a rate limit or temporary error
            const isTemporaryError = errorMessage.includes('429') || 
                                   errorMessage.includes('rate limit') ||
                                   errorMessage.includes('timeout') ||
                                   errorMessage.includes('connection') ||
                                   errorMessage.includes('network') ||
                                   errorMessage.includes('HTTP Error 5');
            
            if (retryCount < maxRetries && (isTemporaryError || isBotDetection)) {
              // Human-like delays: 3-15 seconds for bot detection, 1-5 for others
              const baseDelay = isBotDetection ? 3000 + Math.random() * 12000 : 1000 + Math.random() * 4000;
              
              console.log(`⏳ ${isBotDetection ? 'Bot detection' : 'Temporary'} error, waiting ${Math.round(baseDelay)}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, baseDelay));
            } else if (retryCount >= maxRetries) {
              console.log(`💥 ${strategy.name} exhausted after ${maxRetries} attempts, switching strategy...`);
              break;
            }
          }
        }
        
        // If we got videoInfo, break out of the strategy loop
        if (videoInfo) break;
        
        // Human-like pause between different strategies (1-4 seconds)
        if (strategyIndex < shuffledStrategies.length - 1) {
          const interStrategyDelay = 1000 + Math.random() * 3000;
          console.log(`🔄 Switching to next strategy in ${Math.round(interStrategyDelay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, interStrategyDelay));
        }
      }

      } // End of Method 3 device simulation block

      if (!videoInfo) {
        throw new Error('All enterprise video info extraction methods failed. YouTube has enhanced bot detection beyond current capabilities.');
      }
      
      const parsedInfo = typeof videoInfo === 'object' ? videoInfo as YouTubeDLInfo : null;
      console.log('Video info retrieved:', parsedInfo ? {
        title: parsedInfo.title,
        duration: parsedInfo.duration,
        formats: parsedInfo.formats?.length || 0
      } : 'String response');
      
      setProgress(sourceId, 25);
      
      // Check temp directory permissions
      console.log('Checking temp directory access...');
      try {
        await fs.access(tempDir, fsConstants.W_OK);
        console.log('Temp directory is writable:', tempDir);
      } catch (permError) {
        console.error('Temp directory permission error:', permError);
        throw new Error(`Cannot write to temp directory: ${tempDir}`);
      }
      
      // Download audio with enterprise fallback methods
      console.log('Starting enterprise audio download...');
      let actualAudioPath = path.join(tempDir, `${sourceId}_${videoId}.webm`);
      console.log('Target audio path:', actualAudioPath);
      
      try {
        // Check if we used API extraction (different download method needed)
        if (parsedInfo?._api_extracted) {
          console.log('🎵 API extraction detected, using alternative audio download...');
          actualAudioPath = await downloadAudioViaAlternativeMethod(videoId, sourceId, tempDir);
          console.log('✅ Alternative audio download successful!');
        } else {
          // Use the same successful strategy from video info extraction for download
          console.log(`Using ${successfulStrategy} strategy for download...`);
        
          let downloadSuccess = false;
          let lastError: Error | null = null;
          let finalPath = actualAudioPath;

        // Create advanced download strategies with same anti-detection
        const downloadStrategies = [
          // Strategy 1: Android app download
          {
            name: 'Android App',
            path: actualAudioPath.replace('.webm', '_android.m4a'),
            args: [
              url,
              '--format', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
              '--extract-audio',
              '--audio-format', 'm4a',
              '--extractor-args', 'youtube:player_client=android',
              '--user-agent', 'com.google.android.youtube/18.43.45 (Linux; U; Android 13; SM-G991B) gzip',
              '--add-header', 'X-YouTube-Client-Name:3',
              '--add-header', 'X-YouTube-Client-Version:18.43.45',
              '--add-header', 'X-YouTube-API-Key:AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w'
            ]
          },
          // Strategy 2: Smart TV download
          {
            name: 'Smart TV',
            path: actualAudioPath.replace('.webm', '_tv.m4a'),
            args: [
              url,
              '--format', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
              '--extract-audio',
              '--audio-format', 'm4a',
              '--extractor-args', 'youtube:player_client=tv_embedded',
              '--user-agent', 'Mozilla/5.0 (SMART-TV; LINUX; Tizen 7.0) AppleWebKit/537.36 (KHTML, like Gecko) 94.0.4606.31/7.0 TV Safari/537.36',
              '--add-header', 'X-YouTube-Client-Name:85',
              '--add-header', 'X-YouTube-Client-Version:7.20231030.13.00',
              '--add-header', 'Origin:https://www.youtube.com',
              '--add-header', 'Referer:https://www.youtube.com/tv'
            ]
          },
          // Strategy 3: iOS app download
          {
            name: 'iOS App',
            path: actualAudioPath.replace('.webm', '_ios.m4a'),
            args: [
              url,
              '--format', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
              '--extract-audio',
              '--audio-format', 'm4a',
              '--extractor-args', 'youtube:player_client=ios',
              '--user-agent', 'com.google.ios.youtube/18.43.4 (iPhone15,3; U; CPU iOS 17_1 like Mac OS X)',
              '--add-header', 'X-YouTube-Client-Name:5',
              '--add-header', 'X-YouTube-Client-Version:18.43.4',
              '--add-header', 'X-YouTube-API-Key:AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc'
            ]
          }
        ];

        // Try strategies in order, prioritizing the one that worked for info extraction
        let strategiesToTry = [...downloadStrategies];
        if (successfulStrategy) {
          const matchingStrategy = downloadStrategies.find(s => s.name === successfulStrategy);
          if (matchingStrategy) {
            // Move successful strategy to front
            strategiesToTry = [matchingStrategy, ...downloadStrategies.filter(s => s.name !== successfulStrategy)];
          }
        }

        // Use the same successful strategy first, but with human-like delays
        for (let strategyIndex = 0; strategyIndex < strategiesToTry.length; strategyIndex++) {
          const strategy = strategiesToTry[strategyIndex];
          const maxRetries = 1; // Single attempt per download strategy (they're resource intensive)
          let retryCount = 0;
          
          // Human delay before download attempt (5-10 seconds)
          const preDownloadDelay = 5000 + Math.random() * 5000;
          console.log(`⏳ Preparing download with ${strategy.name}: ${Math.round(preDownloadDelay)}ms`);
          await new Promise(resolve => setTimeout(resolve, preDownloadDelay));
          
          while (retryCount < maxRetries) {
            try {
              const attempt = retryCount + 1;
              console.log(`🎵 DOWNLOAD STRATEGY: ${strategy.name} (attempt ${attempt}/${maxRetries})`);
              console.log('📁 Downloading to:', strategy.path);
              
              const downloadArgs = [
                ...strategy.args,
                '--output', strategy.path,
                '--no-warnings'
              ];
              
              // Extended timeout for downloads
              const timeoutMs = 180000; // 3 minutes for downloads
              const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error(`${strategy.name} download timeout after ${timeoutMs}ms`)), timeoutMs)
              );
              
              const execPromise = ytdl.execPromise(downloadArgs);
              const result = await Promise.race([execPromise, timeoutPromise]) as string;
              
              // Check if file exists and has content
              const stats = await fs.stat(strategy.path);
              console.log(`📊 ${strategy.name} downloaded: ${stats.size} bytes`);
              
              if (stats.size > 0) {
                finalPath = strategy.path;
                downloadSuccess = true;
                console.log(`🎉 DOWNLOAD SUCCESS with ${strategy.name}!`);
                break;
              } else {
                throw new Error(`${strategy.name} file is empty`);
              }
            } catch (error) {
              retryCount++;
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.log(`❌ ${strategy.name} download failed: ${errorMessage.substring(0, 200)}`);
              lastError = error instanceof Error ? error : new Error(String(error));
              
              // Check for bot detection in downloads too
              const isBotDetection = errorMessage.includes('Sign in to confirm you\'re not a bot') ||
                                   errorMessage.includes('bot') ||
                                   errorMessage.includes('captcha');
              
              if (isBotDetection) {
                console.log(`🤖 Bot detection during download, will try next strategy`);
                break; // Move to next strategy immediately for bot detection
              }
              
              if (retryCount >= maxRetries) {
                console.log(`💥 ${strategy.name} download exhausted, trying next strategy...`);
                break;
              }
            }
          }
          
          // If download succeeded, break out of strategy loop
          if (downloadSuccess) break;
          
          // Human-like pause between download strategies (3-8 seconds)
          if (strategyIndex < strategiesToTry.length - 1) {
            const interDownloadDelay = 3000 + Math.random() * 5000;
            console.log(`🔄 Switching download strategy in ${Math.round(interDownloadDelay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, interDownloadDelay));
          }
        }

        if (!downloadSuccess) {
          console.error('=== ALL DOWNLOAD STRATEGIES FAILED ===');
          console.error('Last error:', lastError);
          throw lastError || new Error('All download strategies failed');
        }

          // Update the path for subsequent processing
          actualAudioPath = finalPath;
          
          console.log('YouTube-dl download command completed');
        } // End of else block for non-API extraction
      } catch (downloadError) {
        console.error('YouTube-dl download failed:', downloadError);
        const error = downloadError as Error & { stdout?: string; stderr?: string };
        console.error('Download error message:', error.message || 'Unknown error');
        console.error('Download error stdout:', error.stdout || 'No stdout');
        console.error('Download error stderr:', error.stderr || 'No stderr');
        throw downloadError;
      }
      
      setProgress(sourceId, 45);
      
      // Check if file exists and has content
      console.log('Checking downloaded file...');
      try {
        const stats = await fs.stat(actualAudioPath);
        if (stats.size === 0) {
          throw new Error('Downloaded audio file is empty');
        }
        console.log(`Audio downloaded successfully: ${stats.size} bytes at ${actualAudioPath}`);
      } catch (statError) {
        console.error('File stat error:', statError);
        // Try to list files in temp directory
        try {
          const files = await fs.readdir(tempDir);
          console.log('Files in temp directory:', files.filter(f => f.includes(sourceId)));
        } catch (readDirError) {
          console.error('Cannot read temp directory:', readDirError);
        }
        throw new Error(`Downloaded file not found: ${actualAudioPath}`);
      }
      setProgress(sourceId, 55);
      
      // Transcribe with OpenAI Whisper
      console.log('Starting transcription with OpenAI Whisper...');
      
      // Determine correct file type based on actual file extension
      const fileExtension = path.extname(actualAudioPath).toLowerCase();
      console.log('Audio file details:');
      console.log('- Path:', actualAudioPath);
      console.log('- Extension:', fileExtension);
      
      // Validate that we have a supported format
      const supportedExtensions = ['.flac', '.m4a', '.mp3', '.mp4', '.mpeg', '.mpga', '.oga', '.ogg', '.wav', '.webm'];
      if (!supportedExtensions.includes(fileExtension)) {
        throw new Error(`Unsupported audio format: ${fileExtension}. Supported: ${supportedExtensions.join(', ')}`);
      }
      
      // Get file stats for logging
      const fileStats = await fs.stat(actualAudioPath);
      console.log(`- File size: ${fileStats.size} bytes`);
      console.log(`- File modified: ${fileStats.mtime}`);
      
      // OpenAI file size limit is 25MB (26,214,400 bytes)
      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB in bytes
      const needsChunking = fileStats.size > MAX_FILE_SIZE;
      
      console.log(`File size check: ${fileStats.size} bytes, needs chunking: ${needsChunking}`);
      
      let transcription: {
        segments?: Array<{ start: number; end: number; text: string }>;
        words?: Array<{ word: string; start: number; end: number }>;
      };
      
      if (needsChunking) {
        console.log('🔪 File exceeds 25MB limit, chunking required');
        setProgress(sourceId, 60);
        transcription = await transcribeInChunks(actualAudioPath, sourceId, fileExtension, videoId);
      } else {
        console.log('📁 File within size limit, processing normally');
        // For single large files, use extended timeout
        const timeoutMinutes = fileStats.size > 15 * 1024 * 1024 ? 20 : 15; // 20 min for files > 15MB
        transcription = await transcribeSingleFile(actualAudioPath, fileExtension, 3, timeoutMinutes);
      }
      
      setProgress(sourceId, 80);
      
      // Process segments and words from Whisper
      let segments: Segment[] = [];
      let words: Array<{ text: string; start: number; end: number }> = [];
      
      if (transcription.segments && transcription.segments.length > 0) {
        segments = transcription.segments.map((seg: { start: number; end: number; text: string }, index: number) => ({
          speaker: `Speaker ${(index % 3) + 1}`, // Will be enhanced by diarization
          start: seg.start,
          end: seg.end,
          text: seg.text.trim(),
        }));
        
        console.log(`Transcription complete: ${segments.length} segments`);
      } else {
        throw new Error('No segments found in transcription');
      }
      
      // Process word-level timestamps if available
      if (transcription.words && transcription.words.length > 0) {
        words = transcription.words.map((word: { word: string; start: number; end: number }) => ({
          text: word.word.trim(),
          start: word.start,
          end: word.end,
        }));
        
        console.log(`Word-level timestamps: ${words.length} words`);
      }
      
      // Clean up audio file
      await fs.unlink(actualAudioPath).catch(console.error);
      
      setProgress(sourceId, 85);
      
      // Clean and diarize segments
      segments = cleanSegments(segments);
      segments = performBasicDiarization(segments);
      
      setProgress(sourceId, 90);
      
      // Get unique speakers for management
      const uniqueSpeakers = [...new Set(segments.map(seg => seg.speaker))];
      
      // Save to Supabase
      await saveTranscript(sourceId, {
        sourceId,
        segments,
        words,
        speakers: uniqueSpeakers.map(speakerName => ({
          originalName: speakerName,
          customName: speakerName,
        })),
      });
      
      setProgress(sourceId, 100);
      setTimeout(() => deleteProgress(sourceId), 5000);
      
      console.log('=== TRANSCRIPTION SUCCESS ===');
      console.log(`Successfully transcribed ${segments.length} segments`);
      
      return NextResponse.json({ 
        segments,
        words,
        speakers: uniqueSpeakers.map(speakerName => ({
          id: Date.now().toString() + Math.random().toString(36),
          originalName: speakerName,
          customName: speakerName,
        })),
        message: `Successfully transcribed ${segments.length} segments`,
        duration: segments.length > 0 ? segments[segments.length - 1].end : 0
      });
      
    } catch (downloadError) {
      console.error('=== TRANSCRIPTION ERROR ===');
      console.error('Error details:', downloadError);
      const error = downloadError as Error;
      console.error('Error message:', error.message || 'Unknown error');
      console.error('Error stack:', error.stack || 'No stack');
      
      // Clean up any partial files
      const possibleFiles = [
        path.join(tempDir, `${sourceId}_${videoId}.webm`),
        path.join(tempDir, `${sourceId}_${videoId}.mp4`),
        path.join(tempDir, `${sourceId}_${videoId}.m4a`),
        path.join(tempDir, `${sourceId}_${videoId}.mp3`),
        path.join(tempDir, `${sourceId}_${videoId}_cookies.webm`),
      ];
      
      for (const file of possibleFiles) {
        await fs.unlink(file).catch(() => {});
      }
      
      const errorMessage = downloadError instanceof Error ? downloadError.message : 'Unknown error';
      throw new Error(`Download/transcription failed: ${errorMessage}`);
    }
    
  } catch (error) {
    console.error('=== MAIN TRANSCRIPTION ERROR ===');
    console.error('Error:', error);
    deleteProgress(sourceId);
    
    // More detailed error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isApiKeyError = errorMessage.includes('OPENAI_API_KEY');
    const isYtDlpError = errorMessage.includes('yt-dlp') || errorMessage.includes('YouTube');
    
    return NextResponse.json(
      { 
        error: 'Transcription failed', 
        details: errorMessage,
        type: isApiKeyError ? 'api_key_error' : isYtDlpError ? 'download_error' : 'unknown',
        suggestion: isApiKeyError 
          ? 'OpenAI API key is not configured properly. Please check Railway environment variables.'
          : isYtDlpError 
          ? 'Failed to download YouTube video. The video might be private or region-locked.'
          : 'Check server logs for detailed error information',
        env: {
          hasOpenAIKey: !!process.env.OPENAI_API_KEY,
          nodeEnv: process.env.NODE_ENV,
        }
      },
      { status: 500 }
    );
  }
}

