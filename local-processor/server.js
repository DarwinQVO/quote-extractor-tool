#!/usr/bin/env node

/**
 * LOCAL AUDIO PROCESSOR - Hybrid Architecture
 * Runs locally to avoid YouTube IP restrictions
 * Communicates with Railway cloud app
 */

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const OpenAI = require('openai');

const execAsync = promisify(exec);
const app = express();
const PORT = 3001;

// Enable CORS for Railway app
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://quote-extractor-tool-production.up.railway.app'
  ]
}));
app.use(express.json());

// OpenAI client (using same API key)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'local-audio-processor',
    timestamp: new Date().toISOString()
  });
});

// Process video locally
app.post('/process-video', async (req, res) => {
  const { sourceId, url, cloudApiUrl } = req.body;
  
  console.log(`🏠 LOCAL: Processing video ${sourceId} from ${url}`);
  
  let tempFiles = [];
  
  try {
    const tempDir = os.tmpdir();
    const sessionId = `local_${sourceId}_${Date.now()}`;
    
    // Step 1: Extract audio using yt-dlp (LOCAL IP)
    console.log('🎵 LOCAL: Extracting audio with yt-dlp...');
    const audioFile = path.join(tempDir, `${sessionId}.mp3`);
    tempFiles.push(audioFile);
    
    const audioCmd = `yt-dlp --extract-audio --audio-format mp3 --audio-quality 0 --output "${audioFile}" --no-warnings --ignore-errors "${url}"`;
    
    await execAsync(audioCmd, { timeout: 180000 });
    
    if (!fs.existsSync(audioFile)) {
      throw new Error('Audio extraction failed');
    }
    
    const stats = fs.statSync(audioFile);
    console.log(`📁 LOCAL: Audio extracted: ${Math.round(stats.size / 1024 / 1024 * 100) / 100} MB`);
    
    // Step 2: Transcribe with OpenAI Whisper (LOCAL)
    console.log('🤖 LOCAL: Transcribing with OpenAI Whisper...');
    
    // Handle large files
    let finalAudioFile = audioFile;
    if (stats.size > 25 * 1024 * 1024) {
      console.log('✂️ LOCAL: Cropping large audio file...');
      const croppedFile = path.join(tempDir, `${sessionId}_cropped.mp3`);
      tempFiles.push(croppedFile);
      
      await execAsync(`ffmpeg -i "${audioFile}" -t 600 -acodec mp3 -ab 128k "${croppedFile}" -y`, { timeout: 60000 });
      
      if (fs.existsSync(croppedFile)) {
        finalAudioFile = croppedFile;
      }
    }
    
    // Create File object for OpenAI
    const audioBuffer = fs.readFileSync(finalAudioFile);
    const audioFileObj = new File([audioBuffer], 'audio.mp3', { type: 'audio/mpeg' });
    
    const transcription = await openai.audio.transcriptions.create({
      file: audioFileObj,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment', 'word'],
      language: 'en'
    });
    
    console.log('✅ LOCAL: Transcription completed');
    
    // Step 3: Send transcript to Railway cloud
    if (cloudApiUrl) {
      console.log('☁️ LOCAL: Sending transcript to cloud...');
      
      const cloudResponse = await fetch(`${cloudApiUrl}/api/local-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId,
          transcript: {
            segments: transcription.segments || [],
            words: transcription.words || [],
            text: transcription.text,
            language: transcription.language || 'en',
            duration: transcription.segments?.[transcription.segments.length - 1]?.end || 0
          }
        })
      });
      
      if (cloudResponse.ok) {
        console.log('✅ LOCAL: Transcript sent to cloud successfully');
      } else {
        console.error('❌ LOCAL: Failed to send transcript to cloud');
      }
    }
    
    // Cleanup
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    
    res.json({
      success: true,
      sourceId,
      transcript: {
        segments: transcription.segments?.length || 0,
        words: transcription.words?.length || 0,
        duration: transcription.segments?.[transcription.segments.length - 1]?.end || 0,
        method: 'local-whisper'
      }
    });
    
  } catch (error) {
    console.error('❌ LOCAL: Processing failed:', error);
    
    // Cleanup on error
    tempFiles.forEach(file => {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (e) {
        // Ignore cleanup errors
      }
    });
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`🏠 LOCAL AUDIO PROCESSOR running on http://localhost:${PORT}`);
  console.log(`🔗 Ready to process videos for Railway app`);
  console.log(`📊 Status: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 LOCAL: Shutting down audio processor...');
  process.exit(0);
});