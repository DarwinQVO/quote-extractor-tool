#!/usr/bin/env python3
"""
YouTube Audio Transcription Microservice
Streams audio via yt-dlp through BrickData proxy, resamples with ffmpeg,
and transcribes with whisper.cpp - all in RAM without disk writes.
"""

import os
import sys
import io
import subprocess
import signal
from typing import Optional

try:
    import whisper
except ImportError:
    print("Error: openai-whisper not installed. Run: pip install openai-whisper")
    sys.exit(1)


def get_proxy_config() -> str:
    """Build Bright Data proxy configuration exactly like your working curl."""
    user = os.getenv('PROXY_USER')
    password = os.getenv('PROXY_PASS')
    host = os.getenv('PROXY_HOST')
    port = os.getenv('PROXY_PORT')
    
    if not all([user, password, host, port]):
        missing = [var for var, val in [
            ('PROXY_USER', user),
            ('PROXY_PASS', password), 
            ('PROXY_HOST', host),
            ('PROXY_PORT', port)
        ] if not val]
        raise ValueError(f"Missing proxy environment variables: {', '.join(missing)}")
    
    # Use EXACT format that works in your curl command
    # curl --proxy brd.superproxy.io:33335 --proxy-user user:pass
    proxy_url = f"http://{host}:{port}"
    
    print(f"🔐 DEBUG: Proxy URL: {proxy_url}")
    print(f"🔐 DEBUG: Proxy Auth: {user[:20]}...:{password[:3]}...")
    
    return proxy_url, user, password


def transcribe(video_id: str) -> Optional[str]:
    """
    Stream YouTube audio through proxy, resample with ffmpeg, 
    and transcribe with whisper.cpp - all in memory.
    
    Args:
        video_id: YouTube video ID (11 characters)
        
    Returns:
        Transcription text or None if failed
    """
    if not video_id or len(video_id) != 11:
        raise ValueError("Invalid YouTube video ID. Must be 11 characters.")
    
    print(f"🚀 Starting transcription for video: {video_id}")
    
    # Get proxy configuration
    try:
        proxy_url, proxy_user, proxy_pass = get_proxy_config()
        print(f"🌐 Using Bright Data proxy: {os.getenv('PROXY_HOST')}:{os.getenv('PROXY_PORT')}")
    except ValueError as e:
        print(f"❌ Proxy configuration error: {e}")
        return None
    
    # Get whisper model size from environment - optimized for Railway
    model_size = os.getenv('WHISPER_MODEL_SIZE', 'base')  # Use base for speed on Railway
    print(f"🎯 Using Whisper model: {model_size} (optimized for Railway)")
    
    # ENTERPRISE STRATEGY: Try captions first (most reliable with proxy)
    youtube_url = f"https://youtu.be/{video_id}"
    
    # URL-encode the credentials properly for yt-dlp
    from urllib.parse import quote
    encoded_user = quote(proxy_user, safe='')
    encoded_pass = quote(proxy_pass, safe='')
    
    bright_proxy_full = f"http://{encoded_user}:{encoded_pass}@{os.getenv('PROXY_HOST')}:{os.getenv('PROXY_PORT')}"
    
    print(f"🔐 PROXY CONFIG: Using Bright Data residential proxy")
    
    # Strategy 1: Extract captions (MOST RELIABLE)
    print("📝 STRATEGY 1: Attempting caption extraction (fastest & most reliable)...")
    
    caption_file = f"/tmp/{video_id}_captions.vtt"
    caption_cmd = [
        'yt-dlp',
        '--proxy', bright_proxy_full,
        '--write-auto-sub',      # Download automatic captions
        '--skip-download',       # Don't download video
        '--sub-format', 'vtt',   # VTT format
        '--sub-lang', 'en,es',   # Try English and Spanish
        '--no-warnings',
        '--quiet',
        '--output', f'/tmp/{video_id}',  # Base filename
        youtube_url
    ]
    
    try:
        print("🔍 Downloading captions via Bright Data proxy...")
        result = subprocess.run(caption_cmd, capture_output=True, text=True, timeout=60)
        
        # Check for caption files
        caption_files = [
            f"/tmp/{video_id}.en.vtt",
            f"/tmp/{video_id}.es.vtt", 
            f"/tmp/{video_id}.en-US.vtt",
            f"/tmp/{video_id}.vtt"
        ]
        
        caption_text = None
        for cap_file in caption_files:
            if os.path.exists(cap_file):
                print(f"✅ Caption file found: {cap_file}")
                with open(cap_file, 'r', encoding='utf-8') as f:
                    caption_text = f.read()
                os.unlink(cap_file)  # Clean up
                break
        
        if caption_text:
            print("✅ CAPTION EXTRACTION SUCCESSFUL")
            # Parse VTT format to extract clean text
            lines = caption_text.split('\n')
            text_lines = []
            for line in lines:
                line = line.strip()
                if line and not line.startswith('WEBVTT') and '-->' not in line and not line.isdigit():
                    # Remove HTML tags
                    clean_line = line.replace('<c>', '').replace('</c>', '')
                    clean_line = clean_line.strip()
                    if clean_line:
                        text_lines.append(clean_line)
            
            final_text = ' '.join(text_lines)
            if final_text:
                print("📝 Caption text extracted successfully")
                print("-" * 50)
                print(final_text[:500] + "..." if len(final_text) > 500 else final_text)
                print("-" * 50)
                return final_text
        else:
            print("⚠️ No captions found, falling back to audio extraction...")
            
    except Exception as e:
        print(f"❌ Caption extraction failed: {e}")
    
    # Strategy 2: Audio extraction (fallback)
    print("🎵 STRATEGY 2: Attempting audio extraction...")
    
    yt_dlp_cmd = [
        'yt-dlp',
        '-f', 'worstaudio',  # Use worst audio to download faster
        '--proxy', bright_proxy_full,
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', '9',  # Lowest quality for speed
        '--no-check-certificate',
        '--no-warnings',
        '--quiet',
        '-o', '-',  # Output to stdout
        youtube_url
    ]
    
    # Build ffmpeg command for resampling
    ffmpeg_cmd = [
        'ffmpeg',
        '-loglevel', 'error',
        '-i', 'pipe:0',  # Input from stdin
        '-ac', '1',      # Mono channel
        '-ar', '16000',  # 16kHz sample rate
        '-f', 'wav',     # WAV format
        '-'              # Output to stdout
    ]
    
    print("🎵 Starting audio stream pipeline...")
    
    # Set up signal handling for cleanup
    def signal_handler(signum, frame):
        print("🛑 Received interrupt signal, cleaning up...")
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    try:
        # Start yt-dlp process
        print("📡 Downloading audio stream via yt-dlp...")
        yt_dlp_process = subprocess.Popen(
            yt_dlp_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0
        )
        
        # Start ffmpeg process with yt-dlp output as input
        print("🔧 Resampling audio with ffmpeg...")
        ffmpeg_process = subprocess.Popen(
            ffmpeg_cmd,
            stdin=yt_dlp_process.stdout,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            bufsize=0
        )
        
        # Close yt-dlp stdout in parent to allow proper pipe
        yt_dlp_process.stdout.close()
        
        # Read resampled audio data
        print("📥 Reading resampled audio data...")
        audio_data, ffmpeg_stderr = ffmpeg_process.communicate()
        
        # Wait for yt-dlp to complete and check return codes
        yt_dlp_process.wait()
        
        if yt_dlp_process.returncode != 0:
            _, yt_dlp_stderr = yt_dlp_process.communicate()
            print(f"❌ yt-dlp failed with code {yt_dlp_process.returncode}")
            print(f"yt-dlp stderr: {yt_dlp_stderr.decode()}")
            return None
            
        if ffmpeg_process.returncode != 0:
            print(f"❌ ffmpeg failed with code {ffmpeg_process.returncode}")
            print(f"ffmpeg stderr: {ffmpeg_stderr.decode()}")
            return None
        
        if not audio_data:
            print("❌ No audio data received from pipeline")
            return None
            
        print(f"✅ Audio pipeline complete. Received {len(audio_data)} bytes")
        
        # Initialize Whisper model - optimized for Railway
        print(f"🤖 Initializing Whisper model: {model_size}")
        try:
            # Use base model for speed on Railway
            whisper_model = 'base' if model_size in ['large-v3', 'large'] else model_size
            print(f"🚀 Loading optimized model: {whisper_model}")
            model = whisper.load_model(whisper_model)
        except Exception as e:
            print(f"❌ Failed to load Whisper model: {e}")
            # Fallback to tiny model for maximum speed
            print("🔄 Falling back to tiny model for speed...")
            try:
                model = whisper.load_model("tiny")
            except Exception as e2:
                print(f"❌ Fallback model also failed: {e2}")
                return None
        
        # Save audio to temporary file for whisper (it expects file path)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        try:
            # Transcribe audio
            print("🎤 Transcribing audio with OpenAI Whisper...")
            
            # Transcribe with optimized settings for speed
            result = model.transcribe(
                temp_audio_path, 
                language="es",
                fp16=False,  # Use FP32 for stability on Railway
                verbose=False  # Reduce output noise
            )
            
            if result and 'text' in result:
                result_text = result['text'].strip()
            else:
                result_text = str(result).strip()
                
        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_audio_path)
            except:
                pass
        
        if result_text:
            print("✅ Transcription completed successfully!")
            print("📝 Transcript:")
            print("-" * 50)
            print(result_text)
            print("-" * 50)
            return result_text
        else:
            print("⚠️ Transcription completed but result is empty")
            return None
                
    except Exception as e:
        print(f"❌ Transcription failed: {e}")
        return None
            
    except subprocess.TimeoutExpired:
        print("❌ Pipeline timeout - killing processes")
        try:
            yt_dlp_process.kill()
            ffmpeg_process.kill()
        except:
            pass
        return None
        
    except KeyboardInterrupt:
        print("🛑 Process interrupted by user")
        try:
            yt_dlp_process.kill()
            ffmpeg_process.kill()
        except:
            pass
        return None
        
    except Exception as e:
        print(f"❌ Unexpected error in pipeline: {e}")
        return None


def main():
    """CLI interface for the transcription service."""
    if len(sys.argv) != 2:
        print("Usage: python main.py <youtube_video_id>")
        print("Example: python main.py dQw4w9WgXcQ")
        sys.exit(1)
    
    video_id = sys.argv[1].strip()
    
    # Validate video ID format
    if not video_id.replace('-', '').replace('_', '').isalnum() or len(video_id) != 11:
        print(f"❌ Invalid YouTube video ID: {video_id}")
        print("Video ID must be exactly 11 alphanumeric characters (with - and _ allowed)")
        sys.exit(1)
    
    print("🎬 YouTube Audio Transcription Service")
    print("=" * 50)
    
    try:
        result = transcribe(video_id)
        
        if result:
            print(f"\n🎉 Transcription successful for video: {video_id}")
            sys.exit(0)
        else:
            print(f"\n❌ Transcription failed for video: {video_id}")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Fatal error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()