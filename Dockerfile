# Use Node.js 20
FROM node:20-alpine

# Install Python and FFmpeg for yt-dlp-wrap
RUN apk add --no-cache python3 py3-pip ffmpeg

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Set environment variables
ENV NODE_ENV=production
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set database URL for Prisma during build
ENV DATABASE_URL=file:./dev.db

# Skip build in Dockerfile - Railway will handle it
# This avoids the placeholder issue

# Expose port
EXPOSE 3000

# Start script that builds and then starts
CMD ["sh", "-c", "npm run build && npm start"]