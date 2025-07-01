#!/bin/bash

echo "🏠 SETTING UP LOCAL AUDIO PROCESSOR"
echo "===================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if yt-dlp is installed
if ! command -v yt-dlp &> /dev/null; then
    echo "❌ yt-dlp is not installed. Installing yt-dlp..."
    
    # Try different installation methods
    if command -v pip3 &> /dev/null; then
        pip3 install yt-dlp
    elif command -v pip &> /dev/null; then
        pip install yt-dlp
    elif command -v brew &> /dev/null; then
        brew install yt-dlp
    else
        echo "❌ Could not install yt-dlp automatically."
        echo "   Please install manually: https://github.com/yt-dlp/yt-dlp#installation"
        exit 1
    fi
fi

echo "✅ yt-dlp found: $(yt-dlp --version)"

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ ffmpeg is not installed. Installing ffmpeg..."
    
    if command -v brew &> /dev/null; then
        brew install ffmpeg
    elif command -v apt-get &> /dev/null; then
        sudo apt-get update && sudo apt-get install ffmpeg
    else
        echo "❌ Could not install ffmpeg automatically."
        echo "   Please install manually: https://ffmpeg.org/download.html"
        exit 1
    fi
fi

echo "✅ ffmpeg found: $(ffmpeg -version | head -n 1)"

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Check for OpenAI API key
if [ -z "$OPENAI_API_KEY" ]; then
    echo "⚠️  OPENAI_API_KEY not found in environment"
    echo "   Add to your ~/.bashrc or ~/.zshrc:"
    echo "   export OPENAI_API_KEY='sk-your-key-here'"
    echo ""
    echo "   Or create a .env file in this directory"
else
    echo "✅ OPENAI_API_KEY found"
fi

echo ""
echo "🎉 LOCAL PROCESSOR SETUP COMPLETE!"
echo ""
echo "To start the local processor:"
echo "   npm start"
echo ""
echo "The processor will run on http://localhost:3001"
echo "Your Railway app will automatically detect and use it."