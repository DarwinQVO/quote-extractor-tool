-- Script para crear la tabla transcription_progress en Supabase
-- Esta tabla es necesaria para el seguimiento del progreso de transcripción

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

-- Índice para búsquedas por source_id
CREATE INDEX IF NOT EXISTS idx_transcription_progress_source_id ON transcription_progress(source_id);

-- Política RLS para permitir acceso público (mismo nivel que otras tablas)
ALTER TABLE transcription_progress ENABLE ROW LEVEL SECURITY;

-- Permitir SELECT a usuarios anónimos
CREATE POLICY IF NOT EXISTS "Allow anonymous select on transcription_progress" 
ON transcription_progress FOR SELECT 
TO anon 
USING (true);

-- Permitir INSERT a usuarios anónimos  
CREATE POLICY IF NOT EXISTS "Allow anonymous insert on transcription_progress" 
ON transcription_progress FOR INSERT 
TO anon 
WITH CHECK (true);

-- Permitir UPDATE a usuarios anónimos
CREATE POLICY IF NOT EXISTS "Allow anonymous update on transcription_progress" 
ON transcription_progress FOR UPDATE 
TO anon 
USING (true)
WITH CHECK (true);

-- Permitir DELETE a usuarios anónimos
CREATE POLICY IF NOT EXISTS "Allow anonymous delete on transcription_progress" 
ON transcription_progress FOR DELETE 
TO anon 
USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_transcription_progress_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar updated_at
DROP TRIGGER IF EXISTS update_transcription_progress_updated_at ON transcription_progress;
CREATE TRIGGER update_transcription_progress_updated_at
  BEFORE UPDATE ON transcription_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_transcription_progress_updated_at();