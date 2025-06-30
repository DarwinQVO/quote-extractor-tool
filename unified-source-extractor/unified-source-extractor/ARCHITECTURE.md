# Unified Source Extractor - Architecture Design

## 🎯 Project Vision

Unified application combining the best of **Quote Extractor Tool** and **Source Library** into a comprehensive content management and research platform.

## 🏗️ Architecture Overview

### Core Modules

1. **YouTube Extractor Module** (from quote-extractor-tool)
   - Advanced transcription with OpenAI Whisper
   - Parallel chunking for long videos
   - Word-level timestamp precision
   - Enterprise-grade error handling

2. **Source Library Module** (from source-library)
   - Multi-source content management
   - Rich metadata extraction
   - Category and entity organization
   - Advanced search and filtering

3. **Quote Management System** (unified)
   - Integrated quote creation from videos and sources
   - Advanced citation formatting
   - Contextual quote organization
   - Export capabilities

4. **Visualization Modules** (from source-library)
   - Timeline view for chronological data
   - Geographic mapping for location-based content
   - Storyline visualization for narrative tracking
   - Interactive data exploration

## 🔧 Technology Stack

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand
- **UI Components**: Radix UI
- **Animations**: Framer Motion

### Backend
- **API**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **External APIs**: 
  - OpenAI (Whisper & GPT)
  - YouTube Data API
  - Link Preview Services
  - Google Docs API

### Infrastructure
- **Hosting**: Railway (optimized for media processing)
- **File Storage**: Supabase Storage
- **CDN**: Railway integrated CDN
- **Media Processing**: ffmpeg + yt-dlp

## 📊 Database Schema (Unified)

### Core Tables

```sql
-- Unified sources table (combines both video and web sources)
sources (
  id: string,
  url: string,
  type: 'youtube' | 'web' | 'document',
  title: string,
  description: text,
  metadata: jsonb, -- flexible metadata storage
  categories: string[],
  entities: string[],
  status: 'pending' | 'processing' | 'ready' | 'error',
  created_at: timestamp
)

-- Enhanced quotes table
quotes (
  id: string,
  source_id: string, -- references sources.id
  text: text,
  speaker: string, -- for video quotes
  start_time: real, -- for video quotes
  end_time: real, -- for video quotes
  context: text, -- surrounding context
  categories: string[],
  tags: string[],
  citation: string,
  created_at: timestamp
)

-- Transcripts table (for video sources)
transcripts (
  id: string,
  source_id: string,
  segments: jsonb,
  words: jsonb,
  speakers: jsonb,
  processing_metadata: jsonb
)

-- Characters/Entities table
characters (
  id: string,
  name: string,
  role: string,
  description: text,
  color: string,
  associated_sources: string[]
)
```

## 🎨 UI/UX Design

### Layout Structure
```
┌─────────────────────────────────────┐
│           Top Navigation            │
├─────────────────────────────────────┤
│  Sidebar  │    Main Content Area    │
│           │                         │
│  Modules: │  • YouTube Extractor    │
│  • Videos │  • Source Library       │
│  • Sources│  • Quote Manager        │
│  • Quotes │  • Timeline View        │
│  • Maps   │  • Geographic View      │
│  • Stories│  • Storyline View       │
│           │                         │
└─────────────────────────────────────┘
```

### Key Features
- **Unified Search**: Search across all content types
- **Cross-Module Navigation**: Seamless transitions between modules
- **Contextual Actions**: Smart actions based on content type
- **Responsive Design**: Mobile-first approach
- **Dark/Light Mode**: Theme support
- **Accessibility**: WCAG 2.1 AA compliance

## 🔄 Data Flow

### Video Processing Flow
1. User adds YouTube URL
2. Metadata extraction
3. Audio download and chunking
4. Parallel transcription processing
5. Quote extraction and organization
6. Integration with source library

### Source Management Flow
1. User adds web source/document
2. Metadata extraction via link preview
3. Content categorization
4. Entity recognition
5. Quote extraction (manual/automated)
6. Cross-referencing with existing content

## 🚀 Performance Optimizations

### Client-Side
- **Code Splitting**: Module-based lazy loading
- **State Management**: Optimized Zustand stores
- **Caching**: React Query for API caching
- **Virtual Scrolling**: For large datasets

### Server-Side
- **Parallel Processing**: Concurrent transcription chunks
- **Database Optimization**: Proper indexing and queries
- **Edge Computing**: Next.js Edge Runtime where applicable
- **Memory Management**: Garbage collection and cleanup

## 🔐 Security & Privacy

### Data Protection
- **Row Level Security**: Supabase RLS policies
- **API Rate Limiting**: Prevent abuse
- **Input Validation**: Comprehensive sanitization
- **Environment Security**: Secure credential management

### User Privacy
- **Data Ownership**: Users own their content
- **Minimal Data Collection**: Only necessary metadata
- **Transparent Processing**: Clear data usage policies
- **Export Capabilities**: Data portability

## 📈 Scalability Considerations

### Horizontal Scaling
- **Stateless Architecture**: No server-side sessions
- **Database Sharding**: Partition by user/content type
- **CDN Integration**: Global content delivery
- **Microservices Ready**: Modular architecture for future splitting

### Performance Monitoring
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Core Web Vitals monitoring
- **Usage Analytics**: Feature usage tracking
- **Resource Monitoring**: CPU, memory, database performance

## 🔮 Future Enhancements

### Phase 2 Features
- **AI-Powered Insights**: Content analysis and recommendations
- **Collaboration**: Team workspaces and sharing
- **Advanced Visualization**: Custom chart types and dashboards
- **API Platform**: Public API for third-party integrations

### Phase 3 Features
- **Mobile Applications**: Native iOS/Android apps
- **Real-time Collaboration**: Live editing and commenting
- **Advanced Analytics**: Business intelligence features
- **Enterprise Features**: SSO, advanced permissions, audit logs

---

*This architecture provides a solid foundation for combining both projects while maintaining scalability, performance, and user experience at enterprise level.*