# Railway Production Dockerfile with Hybrid Node.js + Python Support
FROM node:18-slim

# Install system dependencies including Python, ffmpeg and yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    yt-dlp \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy Node.js package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy Python transcription requirements and install with break-system-packages
COPY transcription/requirements.txt ./transcription/
RUN pip3 install --break-system-packages --no-cache-dir -r transcription/requirements.txt

# Copy all source code
COPY . .

# Build the Next.js application
RUN npm run build

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
ENV YTDLP_BINARY_DOWNLOAD=1

# Start the Next.js application
CMD ["npm", "start"]