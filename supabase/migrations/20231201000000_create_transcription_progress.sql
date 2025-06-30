-- Create transcription_progress table for persistent progress tracking
-- This solves the Railway ephemeral storage issue

CREATE TABLE IF NOT EXISTS transcription_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL UNIQUE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  stage TEXT NOT NULL DEFAULT 'initializing' CHECK (stage IN ('initializing', 'extracting', 'transcribing', 'enhancing', 'saving', 'done')),
  message TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  
  -- Indexes for performance
  CONSTRAINT transcription_progress_source_id_key UNIQUE (source_id)
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_transcription_progress_source_id ON transcription_progress(source_id);
CREATE INDEX IF NOT EXISTS idx_transcription_progress_status ON transcription_progress(status);
CREATE INDEX IF NOT EXISTS idx_transcription_progress_updated_at ON transcription_progress(updated_at);

-- Enable Row Level Security
ALTER TABLE transcription_progress ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (you can restrict this later)
CREATE POLICY "Allow all operations on transcription_progress" ON transcription_progress
  FOR ALL USING (true);

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transcription_progress_updated_at 
  BEFORE UPDATE ON transcription_progress 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Add cleanup function for old progress records
CREATE OR REPLACE FUNCTION cleanup_old_transcription_progress()
RETURNS void AS $$
BEGIN
  DELETE FROM transcription_progress 
  WHERE status IN ('completed', 'error') 
    AND updated_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-transcription-progress', '0 2 * * *', 'SELECT cleanup_old_transcription_progress();');