# Enterprise Setup - Professional Transcription & Metadata

## Required API Keys for Production

### 1. Google YouTube Data API v3 (Metadata)
```bash
# Get from: https://console.cloud.google.com/
# Enable YouTube Data API v3
# Create credentials > API Key
GOOGLE_API_KEY=your_youtube_api_key_here
```

### 2. AssemblyAI API Key (Primary Transcription)
```bash
# Get from: https://www.assemblyai.com/dashboard/signup
# Most reliable transcription service
# No audio download needed - works with YouTube URLs directly
ASSEMBLY_AI_API_KEY=your_assemblyai_api_key_here
```

### 3. OpenAI API Key (Fallback)
```bash
# Get from: https://platform.openai.com/api-keys
# Used as fallback if AssemblyAI unavailable
OPENAI_API_KEY=sk-your_openai_api_key_here
```

## Railway Deployment Setup

1. Go to Railway dashboard: https://railway.app/dashboard
2. Select your project: quote-extractor-tool-production
3. Go to Variables tab
4. Add environment variables:
   - `GOOGLE_API_KEY` = your YouTube API key
   - `ASSEMBLY_AI_API_KEY` = your AssemblyAI API key (primary)
   - `OPENAI_API_KEY` = your OpenAI API key (fallback)

## System Capabilities with Real APIs

### With GOOGLE_API_KEY:
✅ Real video titles, channels, descriptions
✅ Accurate duration and view counts  
✅ High-resolution thumbnails
✅ Upload dates and tags

### With ASSEMBLY_AI_API_KEY:
✅ Professional-grade transcription (no audio download needed)
✅ Automatic speaker diarization
✅ Word-level timing with confidence scores
✅ Superior accuracy vs yt-dlp/Whisper
✅ Handles any video length
✅ Enterprise-grade reliability

### With OPENAI_API_KEY (Fallback):
✅ Backup transcription method
✅ Whisper model integration
✅ Word-level timing
✅ Multiple language support

## Current Status (Fallback Mode)
⚠️ Without API keys, system uses:
- Basic video ID as title
- Demo transcript with timing
- Functional but not production-grade

## Test Command
```bash
# After configuring APIs, test with:
curl -X POST https://quote-extractor-tool-production.up.railway.app/api/video-processor \
  -H "Content-Type: application/json" \
  -d '{"sourceId":"real-test","url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Enterprise Features Enabled
- ✅ Real metadata extraction
- ✅ Professional audio processing  
- ✅ OpenAI Whisper transcription
- ✅ Word-level synchronization
- ✅ Error handling & logging
- ✅ File size optimization
- ✅ Database persistence