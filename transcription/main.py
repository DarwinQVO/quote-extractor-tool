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
    """Build proxy string from environment variables."""
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
    
    # URL encode user and password to handle special characters
    from urllib.parse import quote
    encoded_user = quote(user, safe='')
    encoded_pass = quote(password, safe='')
    
    proxy_url = f"https://{encoded_user}:{encoded_pass}@{host}:{port}"
    print(f"🔐 DEBUG: Proxy URL format: https://***:***@{host}:{port}")
    
    return proxy_url


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
        proxy_url = get_proxy_config()
        print(f"🌐 Using BrickData proxy: {os.getenv('PROXY_HOST')}:{os.getenv('PROXY_PORT')}")
    except ValueError as e:
        print(f"❌ Proxy configuration error: {e}")
        return None
    
    # Get whisper model size from environment
    model_size = os.getenv('WHISPER_MODEL_SIZE', 'large-v3')
    print(f"🎯 Using Whisper model: {model_size}")
    
    # Build yt-dlp command for streaming
    youtube_url = f"https://youtu.be/{video_id}"
    yt_dlp_cmd = [
        'yt-dlp',
        '-f', 'bestaudio[ext=m4a]',
        '--proxy', proxy_url,
        '--concurrent-fragments', '5',
        '--fragment-retries', 'infinite',
        '--retries', 'infinite',
        '--throttled-rate', '2M',
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
        
        # Initialize Whisper model
        print(f"🤖 Initializing Whisper model: {model_size}")
        try:
            # Map model sizes for openai-whisper
            model_map = {
                'large-v3': 'large',
                'medium': 'medium',
                'small': 'small'
            }
            whisper_model = model_map.get(model_size, 'medium')
            model = whisper.load_model(whisper_model)
        except Exception as e:
            print(f"❌ Failed to load Whisper model: {e}")
            # Fallback to base model if large fails
            if model_size == 'large-v3':
                print("🔄 Falling back to base model...")
                try:
                    model = whisper.load_model("base")
                except Exception as e2:
                    print(f"❌ Fallback model also failed: {e2}")
                    return None
            else:
                return None
        
        # Save audio to temporary file for whisper (it expects file path)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_audio:
            temp_audio.write(audio_data)
            temp_audio_path = temp_audio.name
        
        try:
            # Transcribe audio
            print("🎤 Transcribing audio with OpenAI Whisper...")
            
            # Transcribe with Spanish language preference
            result = model.transcribe(temp_audio_path, language="es")
            
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