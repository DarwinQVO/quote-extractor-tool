-- Create a view that provides transcript text computed from segments
-- This view makes it easier to work with transcripts in the UI

CREATE OR REPLACE VIEW transcripts_with_text AS
SELECT 
  t.id,
  t.source_id,
  t.segments,
  t.words,
  t.speakers,
  t.processing_metadata,
  t.confidence_score,
  t.word_count,
  t.created_at,
  t.updated_at,
  -- Compute text from segments
  COALESCE(
    (
      SELECT string_agg(seg->>'text', ' ' ORDER BY (seg->>'start')::float)
      FROM jsonb_array_elements(t.segments) AS seg
    ),
    ''
  ) AS text
FROM transcripts t;

-- Grant permissions on the view
GRANT SELECT ON transcripts_with_text TO authenticated;
GRANT SELECT ON transcripts_with_text TO anon;

-- Add RLS policy for the view
ALTER VIEW transcripts_with_text SET (security_invoker = on);

-- Optional: Create a function to get transcript text
CREATE OR REPLACE FUNCTION get_transcript_text(transcript_id TEXT)
RETURNS TEXT AS $$
DECLARE
  result TEXT;
BEGIN
  SELECT 
    COALESCE(
      (
        SELECT string_agg(seg->>'text', ' ' ORDER BY (seg->>'start')::float)
        FROM transcripts t, jsonb_array_elements(t.segments) AS seg
        WHERE t.id = transcript_id
      ),
      ''
    )
  INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Example usage:
-- SELECT * FROM transcripts_with_text WHERE source_id = 'some-id';
-- SELECT get_transcript_text('transcript-id');