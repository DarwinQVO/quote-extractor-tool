import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getPrismaClient, ensureDatabaseTables } from '@/lib/prisma';
import { cleanSegments, performBasicDiarization } from '@/lib/cleanTranscript';
import { Segment } from '@/lib/types';
import YTDlpWrap from 'yt-dlp-wrap';
import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { setProgress, deleteProgress } from '@/lib/transcription-progress';
import { YouTubeDLInfo } from '@/lib/youtube-types';

// Initialize OpenAI client only when needed to avoid build-time errors
let openaiClient: OpenAI | null = null;

function getOpenAIClient() {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔍 Raw OpenAI Check:', {
      exists: !!apiKey,
      value: apiKey || 'UNDEFINED',
      length: apiKey?.length || 0,
      startsWithSk: apiKey?.startsWith('sk-') || false,
    });
    
    if (!apiKey || apiKey === 'build-placeholder' || apiKey === 'build-test') {
      throw new Error(`OpenAI API key not configured. Current: "${apiKey}"`);
    }
    
    if (!apiKey.startsWith('sk-')) {
      throw new Error(`Invalid OpenAI API key format. Must start with 'sk-'`);
    }
    
    openaiClient = new OpenAI({ apiKey });
    console.log('✅ OpenAI client created');
  }
  return openaiClient;
}

// Initialize yt-dlp-wrap - use system binary if available
let ytDlpWrap: YTDlpWrap | null = null;

async function getYTDlpWrap() {
  if (!ytDlpWrap) {
    console.log('🔧 Initializing yt-dlp-wrap...');
    
    try {
      // Try system yt-dlp first (installed via Nixpkgs)
      try {
        console.log('🔍 Trying system yt-dlp binary...');
        ytDlpWrap = new YTDlpWrap('yt-dlp');
        await ytDlpWrap.execPromise(['--version']);
        console.log('✅ Using system yt-dlp binary');
      } catch (systemError) {
        console.log('⚠️ System yt-dlp failed, using auto-download...');
        // Fallback to auto-download
        ytDlpWrap = new YTDlpWrap();
        await ytDlpWrap.getBinaryVersion();
        console.log('✅ Auto-downloaded yt-dlp binary ready');
      }
    } catch (error) {
      console.error('❌ Failed to initialize yt-dlp-wrap:', error);
      throw error;
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
    
    console.log('🗄️ Ensuring database tables exist...');
    try {
      await ensureDatabaseTables();
      console.log('✅ Database tables verified');
    } catch (dbError) {
      console.error('❌ Database initialization failed:', dbError);
      return NextResponse.json({
        error: 'Database initialization error',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }, { status: 500 });
    }
    
    console.log('🗄️ Checking for existing transcript...');
    // Get the properly initialized Prisma client
    const prisma = getPrismaClient();
    
    // Check if transcript already exists and is recent
    const existingTranscript = await prisma.transcript.findUnique({
      where: { sourceId },
    });
    
    if (existingTranscript) {
      const hoursSinceUpdate = (Date.now() - existingTranscript.updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24 && existingTranscript.segments) {
        // Return cached transcript
        const segments: Segment[] = (existingTranscript.segments as any[]).map(s => ({
          speaker: s.speaker,
          start: s.start,
          end: s.end,
          text: s.text,
        }));
        
        return NextResponse.json({ segments, cached: true });
      }
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
      
      // Get video info first
      console.log('Getting video info...');
      const videoInfo = await ytdl.execPromise([
        url,
        '--dump-json',
        '--no-warnings',
        '--skip-download'
      ]).then(JSON.parse);
      
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
      
      // Download audio with better error handling
      console.log('Starting audio download...');
      let actualAudioPath = path.join(tempDir, `${sourceId}_${videoId}.webm`);
      console.log('Target audio path:', actualAudioPath);
      
      try {
        // Try multiple strategies for downloading
        let downloadSuccess = false;
        let lastError: Error | null = null;
        let finalPath = actualAudioPath;

        // Strategy 1: Try with m4a format first (most compatible with OpenAI)
        console.log('=== STRATEGY 1: M4A Download ===');
        try {
          const m4aPath = actualAudioPath.replace('.webm', '.m4a');
          console.log('Attempting m4a download to:', m4aPath);
          
          const m4aResult = await ytdl.execPromise([
            url,
            '--format', 'bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio',
            '--output', m4aPath,
            '--extract-audio',
            '--audio-format', 'm4a',
            '--no-warnings',
            '--verbose'
          ]);
          console.log('M4A download output:', m4aResult);
          
          // Check if file exists and has content
          const m4aStats = await fs.stat(m4aPath);
          console.log(`M4A file size: ${m4aStats.size} bytes`);
          
          if (m4aStats.size > 0) {
            finalPath = m4aPath; // Keep as m4a, don't rename
            downloadSuccess = true;
            console.log('Downloaded successfully with m4a format');
          } else {
            throw new Error('M4A file is empty');
          }
        } catch (m4aError) {
          console.log('M4A download failed:', m4aError);
          lastError = m4aError instanceof Error ? m4aError : new Error(String(m4aError));
        }

        // Strategy 2: Try with mp3 extraction
        if (!downloadSuccess) {
          console.log('=== STRATEGY 2: MP3 Extract ===');
          try {
            const mp3Path = actualAudioPath.replace('.webm', '.mp3');
            console.log('Attempting mp3 extract to:', mp3Path);
            
            const mp3Result = await ytdl.execPromise([
              url,
              '--format', 'bestaudio',
              '--extract-audio',
              '--audio-format', 'mp3',
              '--output', mp3Path,
              '--no-warnings',
              '--verbose'
            ]);
            console.log('MP3 extract output:', mp3Result);
            
            // Check if file exists and has content
            const mp3Stats = await fs.stat(mp3Path);
            console.log(`MP3 file size: ${mp3Stats.size} bytes`);
            
            if (mp3Stats.size > 0) {
              finalPath = mp3Path; // Keep as mp3
              downloadSuccess = true;
              console.log('Downloaded successfully with mp3 conversion');
            } else {
              throw new Error('MP3 file is empty');
            }
          } catch (mp3Error) {
            console.log('MP3 download failed:', mp3Error);
            lastError = mp3Error instanceof Error ? mp3Error : new Error(String(mp3Error));
          }
        }

        // Strategy 3: Try with format ID directly
        if (!downloadSuccess) {
          console.log('=== STRATEGY 3: Format ID ===');
          try {
            // First get available formats
            console.log('Getting available formats...');
            const formats = await ytdl.execPromise([
              url,
              '--list-formats',
              '--no-warnings'
            ]);
            console.log('Available formats:', formats);
            
            // Extract audio format IDs (usually 140, 251, etc)
            const audioFormats = formats.match(/(\d+)\s+m4a.*audio only/g) || 
                                formats.match(/(\d+)\s+webm.*audio only/g) ||
                                formats.match(/(\d+)\s+.*audio only/g);
            
            console.log('Found audio formats:', audioFormats);
            
            if (audioFormats && audioFormats.length > 0) {
              const formatId = audioFormats[0].split(/\s+/)[0];
              console.log(`Trying direct format ID: ${formatId}`);
              
              const formatResult = await ytdl.execPromise([
                url,
                '--format', formatId,
                '--output', actualAudioPath,
                '--no-warnings',
                '--verbose'
              ]);
              console.log('Format ID download output:', formatResult);
              
              // Check if file exists and has content
              const formatStats = await fs.stat(actualAudioPath);
              console.log(`Format ID file size: ${formatStats.size} bytes`);
              
              if (formatStats.size > 0) {
                finalPath = actualAudioPath;
                downloadSuccess = true;
                console.log(`Downloaded successfully with format ID ${formatId}`);
              } else {
                throw new Error('Format ID file is empty');
              }
            } else {
              throw new Error('No audio formats found');
            }
          } catch (formatError) {
            console.log('Direct format download failed:', formatError);
            lastError = formatError instanceof Error ? formatError : new Error(String(formatError));
          }
        }

        // Strategy 4: Try with cookies and user agent
        if (!downloadSuccess) {
          console.log('=== STRATEGY 4: Cookies & User Agent ===');
          try {
            const cookiePath = actualAudioPath.replace('.webm', '_cookies.webm');
            console.log('Attempting download with cookies to:', cookiePath);
            
            const cookieResult = await ytdl.execPromise([
              url,
              '--format', 'bestaudio',
              '--output', cookiePath,
              '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
              '--add-header', 'Accept-Language:en-US,en;q=0.9',
              '--no-warnings',
              '--verbose'
            ]);
            console.log('Cookie download output:', cookieResult);
            
            // Check if file exists and has content
            const cookieStats = await fs.stat(cookiePath);
            console.log(`Cookie file size: ${cookieStats.size} bytes`);
            
            if (cookieStats.size > 0) {
              finalPath = cookiePath;
              downloadSuccess = true;
              console.log('Downloaded successfully with cookies and user agent');
            } else {
              throw new Error('Cookie download file is empty');
            }
          } catch (cookieError) {
            console.log('Cookie download failed:', cookieError);
            lastError = cookieError instanceof Error ? cookieError : new Error(String(cookieError));
          }
        }

        if (!downloadSuccess) {
          console.error('=== ALL STRATEGIES FAILED ===');
          console.error('Last error:', lastError);
          throw lastError || new Error('All download strategies failed');
        }

        // Update the path for subsequent processing
        actualAudioPath = finalPath;
        
        console.log('YouTube-dl download command completed');
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
      
      // Read the audio file as a buffer
      const audioBuffer = await fs.readFile(actualAudioPath);
      
      // Create a proper filename with the correct extension
      const audioFileName = `audio${fileExtension}`;
      console.log(`Creating file object with name: ${audioFileName}`);
      
      // For OpenAI API in Node.js, we need to use fs.createReadStream
      // This is the officially recommended approach for the OpenAI Node.js SDK
      const { createReadStream } = await import('fs');
      
      // Ensure we have a file with the correct extension  
      const correctExtensionPath = actualAudioPath.replace(/\.[^.]+$/, fileExtension);
      if (correctExtensionPath !== actualAudioPath) {
        await fs.copyFile(actualAudioPath, correctExtensionPath);
        actualAudioPath = correctExtensionPath;
      }
      
      // Create the stream that OpenAI SDK expects
      const audioFile = createReadStream(actualAudioPath) as any;
      
      // Add required properties for OpenAI SDK
      audioFile.name = audioFileName;
      audioFile.type = fileExtension === '.m4a' ? 'audio/mp4' : 
                      fileExtension === '.mp3' ? 'audio/mpeg' :
                      fileExtension === '.wav' ? 'audio/wav' :
                      fileExtension === '.ogg' ? 'audio/ogg' :
                      'audio/webm';
      
      setProgress(sourceId, 65);
      
      console.log('About to start OpenAI transcription with file stream...');
      console.log('Audio file name:', audioFile.name);
      console.log('Audio file type:', audioFile.type);
      console.log('Audio file path:', audioFile.path);
      
      let transcription: {
        segments?: Array<{ start: number; end: number; text: string }>;
        words?: Array<{ word: string; start: number; end: number }>;
      };
      
      try {
        // Add timeout to prevent hanging
        const openai = getOpenAIClient();
        const transcriptionPromise = openai.audio.transcriptions.create({
          file: audioFile,
          model: 'whisper-1',
          response_format: 'verbose_json',
          timestamp_granularities: ['segment', 'word'],
        });
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Transcription timeout after 5 minutes')), 5 * 60 * 1000)
        );
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        transcription = await Promise.race([transcriptionPromise, timeoutPromise]) as any;
        
        console.log('OpenAI transcription completed successfully');
      } catch (transcriptionError) {
        console.error('OpenAI transcription failed:', transcriptionError);
        console.error('Error details:', {
          name: transcriptionError instanceof Error ? transcriptionError.name : 'Unknown',
          message: transcriptionError instanceof Error ? transcriptionError.message : String(transcriptionError),
          stack: transcriptionError instanceof Error ? transcriptionError.stack : 'No stack'
        });
        throw transcriptionError;
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
      
      // Save to database with JSON fields
      if (existingTranscript) {
        await prisma.transcript.update({
          where: { id: existingTranscript.id },
          data: {
            segments: segments,
            words: words,
            speakers: uniqueSpeakers.map(speakerName => ({
              originalName: speakerName,
              customName: speakerName,
            })),
          },
        });
      } else {
        await prisma.transcript.create({
          data: {
            sourceId,
            segments: segments,
            words: words,
            speakers: uniqueSpeakers.map(speakerName => ({
              originalName: speakerName,
              customName: speakerName,
            })),
          },
        });
      }
      
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

