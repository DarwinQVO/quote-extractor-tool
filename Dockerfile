# Railway Production Dockerfile
# Includes all system dependencies for transcription

FROM node:18-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-setuptools \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN pip3 install yt-dlp

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