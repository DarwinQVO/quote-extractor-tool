// UNIFIED SOURCE EXTRACTOR - TYPE DEFINITIONS
// Enterprise-grade TypeScript types for multi-source content management

// =====================================================
// CORE ENUMS
// =====================================================

export type SourceType = 'youtube' | 'web' | 'document' | 'podcast' | 'social' | 'video' | 'audio';
export type SourceStatus = 'pending' | 'processing' | 'ready' | 'error' | 'archived';
export type ProcessingStage = 'metadata' | 'download' | 'transcription' | 'analysis' | 'complete';

// =====================================================
// SOURCE SYSTEM TYPES
// =====================================================

// Base source interface
export interface SourceBase {
  id: string;
  url: string;
  type: SourceType;
  title: string;
  description?: string;
  author?: string;
  published_at?: Date;
  categories: string[];
  entities: string[];
  tags: string[];
  status: SourceStatus;
  processing_stage?: ProcessingStage;
  processing_data: Record<string, any>;
  error_message?: string;
  user_id?: string;
  created_at: Date;
  updated_at: Date;
}

// Type-specific metadata interfaces
export interface YouTubeMetadata {
  channel: string;
  duration: number; // in seconds
  thumbnail: string;
  view_count?: number;
  video_id: string;
  channel_id?: string;
  upload_date?: string;
}

export interface WebMetadata {
  favicon?: string;
  provider: string;
  image?: string;
  reading_time?: number; // estimated minutes
  domain: string;
  article_html?: string;
  preview_html?: string;
}

export interface DocumentMetadata {
  file_size: number; // in bytes
  page_count?: number;
  format: string; // PDF, DOCX, etc.
  mime_type: string;
  file_path?: string;
  extracted_text?: string;
}

export interface PodcastMetadata {
  episode_number?: number;
  season?: number;
  show_name: string;
  duration: number; // in seconds
  episode_id?: string;
  show_id?: string;
}

// Discriminated union for type-safe source handling
export interface YouTubeSource extends SourceBase {
  type: 'youtube';
  metadata: YouTubeMetadata;
}

export interface WebSource extends SourceBase {
  type: 'web';
  metadata: WebMetadata;
}

export interface DocumentSource extends SourceBase {
  type: 'document';
  metadata: DocumentMetadata;
}

export interface PodcastSource extends SourceBase {
  type: 'podcast';
  metadata: PodcastMetadata;
}

export type Source = YouTubeSource | WebSource | DocumentSource | PodcastSource;

// =====================================================
// QUOTE SYSTEM TYPES
// =====================================================

export interface Quote {
  id: string;
  source_id: string;
  text: string;
  context?: string; // surrounding context
  
  // Video/Audio specific
  speaker?: string;
  start_time?: number; // in seconds
  end_time?: number; // in seconds
  
  // Organization
  categories: string[];
  tags: string[];
  character_ids: string[];
  related_quote_ids: string[];
  
  // Citation and reference
  citation: string;
  timestamp_link?: string; // deep link with timestamp
  page_reference?: string; // page number for documents
  
  // Metadata
  user_id?: string;
  exported: boolean;
  created_at: Date;
  updated_at: Date;
}

// Quote with populated source for display
export interface QuoteWithSource extends Quote {
  source: Source;
}

// =====================================================
// TRANSCRIPT SYSTEM TYPES
// =====================================================

export interface TranscriptSegment {
  id: string;
  speaker: string;
  start: number; // in seconds
  end: number; // in seconds
  text: string;
  confidence?: number;
}

export interface TranscriptWord {
  id: string;
  text: string;
  start: number; // in seconds
  end: number; // in seconds
  speaker?: string;
  confidence?: number;
}

export interface Speaker {
  id: string;
  originalName: string;
  customName: string;
  color?: string;
}

export interface Transcript {
  id: string;
  source_id: string;
  segments: TranscriptSegment[];
  words: TranscriptWord[];
  speakers: Speaker[];
  processing_metadata: {
    transcription_model?: string;
    language?: string;
    confidence_score?: number;
    processing_time?: number; // in seconds
    chunk_count?: number;
  };
  confidence_score: number;
  word_count: number;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// CHARACTER/ENTITY SYSTEM TYPES
// =====================================================

export interface Character {
  id: string;
  name: string;
  role?: string;
  description?: string;
  color: string;
  associated_source_ids: string[];
  aliases: string[];
  user_id?: string;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// COLLECTION/WORKSPACE TYPES
// =====================================================

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string;
  source_ids: string[];
  quote_ids: string[];
  user_id?: string;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// UI STATE TYPES
// =====================================================

export interface ViewState {
  currentView: 'sources' | 'quotes' | 'timeline' | 'map' | 'storyline';
  selectedSourceId?: string;
  selectedQuoteId?: string;
  searchQuery: string;
  filters: {
    types: SourceType[];
    categories: string[];
    tags: string[];
    status: SourceStatus[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
}

export interface ModalState {
  addSource: {
    open: boolean;
    type?: SourceType;
  };
  editSource: {
    open: boolean;
    sourceId?: string;
  };
  addQuote: {
    open: boolean;
    sourceId?: string;
    selectedText?: string;
    startTime?: number;
    endTime?: number;
  };
  editQuote: {
    open: boolean;
    quoteId?: string;
  };
  sourceDetail: {
    open: boolean;
    sourceId?: string;
  };
  quoteDetail: {
    open: boolean;
    quoteId?: string;
  };
}

// =====================================================
// API TYPES
// =====================================================

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
  metadata?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export interface SearchResult {
  type: 'source' | 'quote';
  id: string;
  title: string;
  snippet: string;
  rank: number;
  source?: Source; // populated for quote results
}

export interface ProcessingProgress {
  sourceId: string;
  stage: ProcessingStage;
  progress: number; // 0-100
  message?: string;
  error?: string;
}

// =====================================================
// FORM TYPES
// =====================================================

export interface AddSourceForm {
  url: string;
  type?: SourceType; // auto-detected or manual
  categories: string[];
  tags: string[];
}

export interface AddQuoteForm {
  text: string;
  context?: string;
  speaker?: string;
  categories: string[];
  tags: string[];
  character_ids: string[];
}

export interface EditSourceForm {
  title: string;
  description?: string;
  author?: string;
  categories: string[];
  tags: string[];
  entities: string[];
}

// =====================================================
// PROCESSING TYPES
// =====================================================

export interface YouTubeProcessingOptions {
  extractQuotes: boolean;
  speakerDiarization: boolean;
  languageHint?: string;
  qualityPreference: 'speed' | 'quality';
}

export interface WebProcessingOptions {
  extractContent: boolean;
  generateSummary: boolean;
  extractEntities: boolean;
}

export interface DocumentProcessingOptions {
  ocrEnabled: boolean;
  extractMetadata: boolean;
  generateSummary: boolean;
}

// =====================================================
// UTILITY TYPES
// =====================================================

// Type guards for source discrimination
export function isYouTubeSource(source: Source): source is YouTubeSource {
  return source.type === 'youtube';
}

export function isWebSource(source: Source): source is WebSource {
  return source.type === 'web';
}

export function isDocumentSource(source: Source): source is DocumentSource {
  return source.type === 'document';
}

export function isPodcastSource(source: Source): source is PodcastSource {
  return source.type === 'podcast';
}

// Helper type for component props
export type SourceCardProps<T extends Source = Source> = {
  source: T;
  onEdit?: (source: T) => void;
  onDelete?: (sourceId: string) => void;
  onQuoteAdd?: (sourceId: string) => void;
  className?: string;
};

// Export everything as namespace for convenience
export namespace UnifiedTypes {
  export type {
    Source,
    YouTubeSource,
    WebSource,
    DocumentSource,
    PodcastSource,
    Quote,
    QuoteWithSource,
    Transcript,
    Character,
    Collection,
    ViewState,
    ModalState,
    ApiResponse,
    SearchResult,
    ProcessingProgress
  };
}