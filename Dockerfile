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

# Set temporary environment variables for build (will be overridden at runtime)
ENV OPENAI_API_KEY=build-placeholder
ENV NEXT_PUBLIC_SUPABASE_URL=build-placeholder
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=build-placeholder
ENV DATABASE_URL=file:./dev.db

# Build the application
RUN npm run build

# Remove build-time environment variables (they will be set at runtime)
ENV OPENAI_API_KEY=
ENV NEXT_PUBLIC_SUPABASE_URL=
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]