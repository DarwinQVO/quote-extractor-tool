// Manual script to create transcription_progress table via Supabase API
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://fovhdksxpendulsrdjux.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvdmhka3N4cGVuZHVsc3JkanV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3MDM2NTAsImV4cCI6MjA2NjI3OTY1MH0.TsQDB0roZLmJCG1b9oQwaz65Ad00XEWHB5HD4OaWpg4';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTable() {
  console.log('🚀 Creating transcription_progress table...');
  
  try {
    // Try to insert a test record to see if table exists
    const { data: testData, error: testError } = await supabase
      .from('transcription_progress')
      .select('*')
      .limit(1);
    
    if (!testError) {
      console.log('✅ Table already exists!');
      return;
    }
    
    if (testError.code !== '42P01') {
      console.error('❌ Unexpected error:', testError);
      return;
    }
    
    console.log('📝 Table does not exist, need to create it via SQL...');
    console.log('');
    console.log('Run this SQL in your Supabase SQL Editor:');
    console.log('============================================');
    console.log(`
-- Create transcription_progress table
CREATE TABLE IF NOT EXISTS transcription_progress (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  step TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_transcription_progress_source_id ON transcription_progress(source_id);

-- Enable RLS
ALTER TABLE transcription_progress ENABLE ROW LEVEL SECURITY;

-- Allow all operations for anon users (same as other tables)
CREATE POLICY "Allow anonymous select on transcription_progress" 
ON transcription_progress FOR SELECT 
TO anon 
USING (true);

CREATE POLICY "Allow anonymous insert on transcription_progress" 
ON transcription_progress FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update on transcription_progress" 
ON transcription_progress FOR UPDATE 
TO anon 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow anonymous delete on transcription_progress" 
ON transcription_progress FOR DELETE 
TO anon 
USING (true);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_transcription_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_transcription_progress_updated_at
  BEFORE UPDATE ON transcription_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_transcription_progress_updated_at();
    `);
    console.log('============================================');
    console.log('');
    console.log('After running the SQL, press Ctrl+C and restart this script to verify.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

createTable();