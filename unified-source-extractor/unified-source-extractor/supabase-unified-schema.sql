-- UNIFIED SOURCE EXTRACTOR - DATABASE SCHEMA
-- Enterprise-grade schema combining Quote Extractor Tool + Source Library
-- Phase 1: YouTube Videos + Web Articles + Documents

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create custom types
CREATE TYPE source_type AS ENUM ('youtube', 'web', 'document', 'podcast', 'social', 'video', 'audio');
CREATE TYPE source_status AS ENUM ('pending', 'processing', 'ready', 'error', 'archived');
CREATE TYPE processing_stage AS ENUM ('metadata', 'download', 'transcription', 'analysis', 'complete');

-- =====================================================
-- UNIFIED SOURCES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  url TEXT NOT NULL,
  type source_type NOT NULL DEFAULT 'web',
  
  -- Basic metadata (all types)
  title TEXT NOT NULL,
  description TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  
  -- Type-specific metadata (flexible JSONB)
  metadata JSONB NOT NULL DEFAULT '{}',
  /* Metadata structure by type:
    YouTube: { channel, duration, thumbnail, view_count, video_id }
    Web: { favicon, provider, image, reading_time, domain }
    Document: { file_size, page_count, format, mime_type }
    Podcast: { episode_number, season, show_name, duration }
  */
  
  -- Advanced organization
  categories TEXT[] DEFAULT '{}',
  entities TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Processing status
  status source_status NOT NULL DEFAULT 'pending',
  processing_stage processing_stage DEFAULT 'metadata',
  processing_data JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- User association (future multi-user support)
  user_id TEXT, -- Will be populated when auth is added
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_url CHECK (url ~ '^https?://'),
  CONSTRAINT metadata_not_null CHECK (metadata IS NOT NULL)
);

-- =====================================================
-- ENHANCED QUOTES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  
  -- Quote content
  text TEXT NOT NULL,
  context TEXT, -- Surrounding context for better understanding
  
  -- Video-specific fields (YouTube, Podcast, etc.)
  speaker TEXT,
  start_time REAL, -- In seconds
  end_time REAL,   -- In seconds
  
  -- Advanced organization
  categories TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  character_ids TEXT[] DEFAULT '{}', -- References to characters table
  related_quote_ids TEXT[] DEFAULT '{}', -- Cross-references
  
  -- Citation and export
  citation TEXT NOT NULL,
  timestamp_link TEXT, -- Deep link with timestamp (for videos)
  page_reference TEXT, -- Page number (for documents)
  
  -- User and status
  user_id TEXT, -- Future multi-user support
  exported BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT text_not_empty CHECK (LENGTH(TRIM(text)) > 0),
  CONSTRAINT valid_timestamps CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time >= start_time)
  )
);

-- =====================================================
-- TRANSCRIPTS TABLE (Video/Audio sources)
-- =====================================================
CREATE TABLE IF NOT EXISTS transcripts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source_id TEXT NOT NULL UNIQUE REFERENCES sources(id) ON DELETE CASCADE,
  
  -- Transcript data
  segments JSONB NOT NULL DEFAULT '[]',
  words JSONB NOT NULL DEFAULT '[]',
  speakers JSONB NOT NULL DEFAULT '[]',
  
  -- Processing metadata
  processing_metadata JSONB DEFAULT '{}',
  /* Processing metadata structure:
    { 
      transcription_model: 'whisper-1',
      language: 'en',
      confidence_score: 0.95,
      processing_time: 120,
      chunk_count: 5
    }
  */
  
  -- Quality metrics
  confidence_score REAL DEFAULT 0.0,
  word_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT segments_is_array CHECK (jsonb_typeof(segments) = 'array'),
  CONSTRAINT words_is_array CHECK (jsonb_typeof(words) = 'array'),
  CONSTRAINT speakers_is_array CHECK (jsonb_typeof(speakers) = 'array')
);

-- =====================================================
-- CHARACTERS/ENTITIES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  role TEXT,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3B82F6',
  
  -- Associations
  associated_source_ids TEXT[] DEFAULT '{}',
  aliases TEXT[] DEFAULT '{}', -- Alternative names
  
  -- User association
  user_id TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT name_not_empty CHECK (LENGTH(TRIM(name)) > 0),
  CONSTRAINT valid_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$')
);

-- =====================================================
-- COLLECTIONS/WORKSPACES (Future phase)
-- =====================================================
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  
  -- Collection metadata
  source_ids TEXT[] DEFAULT '{}',
  quote_ids TEXT[] DEFAULT '{}',
  
  -- User association
  user_id TEXT,
  is_public BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Sources indexes
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_sources_created_at ON sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sources_categories ON sources USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_sources_entities ON sources USING GIN(entities);
CREATE INDEX IF NOT EXISTS idx_sources_tags ON sources USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_sources_user_id ON sources(user_id);
CREATE INDEX IF NOT EXISTS idx_sources_title_search ON sources USING GIN(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_sources_metadata ON sources USING GIN(metadata);

-- Quotes indexes
CREATE INDEX IF NOT EXISTS idx_quotes_source_id ON quotes(source_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_categories ON quotes USING GIN(categories);
CREATE INDEX IF NOT EXISTS idx_quotes_tags ON quotes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_quotes_character_ids ON quotes USING GIN(character_ids);
CREATE INDEX IF NOT EXISTS idx_quotes_user_id ON quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_text_search ON quotes USING GIN(to_tsvector('english', text));
CREATE INDEX IF NOT EXISTS idx_quotes_exported ON quotes(exported);

-- Transcripts indexes  
CREATE INDEX IF NOT EXISTS idx_transcripts_source_id ON transcripts(source_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_confidence ON transcripts(confidence_score);
CREATE INDEX IF NOT EXISTS idx_transcripts_word_count ON transcripts(word_count);

-- Characters indexes
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_source_ids ON characters USING GIN(associated_source_ids);

-- Collections indexes
CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON collections(is_public);
CREATE INDEX IF NOT EXISTS idx_collections_source_ids ON collections USING GIN(source_ids);

-- =====================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
DROP TRIGGER IF EXISTS update_sources_updated_at ON sources;
CREATE TRIGGER update_sources_updated_at 
  BEFORE UPDATE ON sources 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_quotes_updated_at ON quotes;
CREATE TRIGGER update_quotes_updated_at 
  BEFORE UPDATE ON quotes 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transcripts_updated_at ON transcripts;
CREATE TRIGGER update_transcripts_updated_at 
  BEFORE UPDATE ON transcripts 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_characters_updated_at ON characters;
CREATE TRIGGER update_characters_updated_at 
  BEFORE UPDATE ON characters 
  FOR EACH ROW EXECUTE FUNCTION update_characters_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at 
  BEFORE UPDATE ON collections 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for now - will be restricted when auth is added)
DROP POLICY IF EXISTS "Allow all operations on sources" ON sources;
CREATE POLICY "Allow all operations on sources" ON sources FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on quotes" ON quotes;
CREATE POLICY "Allow all operations on quotes" ON quotes FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on transcripts" ON transcripts;
CREATE POLICY "Allow all operations on transcripts" ON transcripts FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on characters" ON characters;
CREATE POLICY "Allow all operations on characters" ON characters FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all operations on collections" ON collections;
CREATE POLICY "Allow all operations on collections" ON collections FOR ALL USING (true);

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to get source with stats
CREATE OR REPLACE FUNCTION get_source_with_stats(source_id_param TEXT)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'source', row_to_json(s.*),
    'stats', json_build_object(
      'quote_count', (SELECT COUNT(*) FROM quotes WHERE source_id = source_id_param),
      'transcript_exists', (SELECT EXISTS(SELECT 1 FROM transcripts WHERE source_id = source_id_param)),
      'character_count', (SELECT COUNT(DISTINCT unnest(character_ids)) FROM quotes WHERE source_id = source_id_param)
    )
  )
  INTO result
  FROM sources s
  WHERE s.id = source_id_param;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to search across all content
CREATE OR REPLACE FUNCTION search_content(search_term TEXT)
RETURNS TABLE(
  type TEXT,
  id TEXT,
  title TEXT,
  snippet TEXT,
  rank REAL
) AS $$
BEGIN
  RETURN QUERY
  (
    SELECT 
      'source'::TEXT as type,
      s.id,
      s.title,
      COALESCE(LEFT(s.description, 200), '')::TEXT as snippet,
      ts_rank(to_tsvector('english', s.title || ' ' || COALESCE(s.description, '')), plainto_tsquery('english', search_term)) as rank
    FROM sources s
    WHERE to_tsvector('english', s.title || ' ' || COALESCE(s.description, '')) @@ plainto_tsquery('english', search_term)
  )
  UNION ALL
  (
    SELECT 
      'quote'::TEXT as type,
      q.id,
      LEFT(q.text, 100)::TEXT as title,
      q.text::TEXT as snippet,
      ts_rank(to_tsvector('english', q.text), plainto_tsquery('english', search_term)) as rank
    FROM quotes q
    WHERE to_tsvector('english', q.text) @@ plainto_tsquery('english', search_term)
  )
  ORDER BY rank DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA (Development only)
-- =====================================================

-- Sample sources for testing
INSERT INTO sources (id, url, type, title, description, metadata, categories, status) VALUES
('test-yt-1', 'https://youtube.com/watch?v=example1', 'youtube', 'Sample YouTube Video', 'A sample video for testing', '{"channel": "Test Channel", "duration": 600, "video_id": "example1"}', '{"education", "technology"}', 'ready'),
('test-web-1', 'https://example.com/article', 'web', 'Sample Article', 'A sample web article for testing', '{"provider": "Example.com", "reading_time": 5}', '{"news", "technology"}', 'ready'),
('test-doc-1', 'https://example.com/document.pdf', 'document', 'Sample Document', 'A sample PDF document for testing', '{"file_size": 1024000, "page_count": 10, "format": "PDF"}', '{"research", "academic"}', 'ready')
ON CONFLICT (id) DO NOTHING;

-- Sample quotes for testing
INSERT INTO quotes (id, source_id, text, speaker, citation, categories) VALUES
('test-quote-1', 'test-yt-1', 'This is a sample quote from the video', 'Speaker 1', 'Sample YouTube Video, Speaker 1', '{"education"}'),
('test-quote-2', 'test-web-1', 'This is a sample quote from the article', NULL, 'Sample Article (Example.com)', '{"technology"}'),
('test-quote-3', 'test-doc-1', 'This is a sample quote from the document', NULL, 'Sample Document, p. 5', '{"research"}')
ON CONFLICT (id) DO NOTHING;