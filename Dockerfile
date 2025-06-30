# Railway Production Dockerfile
# Includes all system dependencies for transcription

FROM node:18-slim

# Install system dependencies including yt-dlp from apt
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    yt-dlp \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
ENV YTDLP_BINARY_DOWNLOAD=1

# Start the application
CMD ["npm", "start"]