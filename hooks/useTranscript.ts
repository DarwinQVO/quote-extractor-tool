import { useQuery } from '@tanstack/react-query';
import { Transcript } from '@/lib/types';

async function fetchTranscript(sourceId: string): Promise<Transcript | null> {
  try {
    console.log('🔍 Fetching transcript for sourceId:', sourceId);
    const response = await fetch(`/api/transcripts/${sourceId}`);
    console.log('📡 Transcript fetch response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('📭 Transcript not found (404) for sourceId:', sourceId);
        return null;
      }
      throw new Error('Failed to fetch transcript');
    }
    
    const transcript = await response.json();
    console.log('✅ Transcript fetched successfully:', {
      sourceId,
      segments: transcript.segments?.length || 0,
      words: transcript.words?.length || 0
    });
    
    return transcript;
  } catch (error) {
    console.error('❌ Error fetching transcript:', error);
    return null;
  }
}

export function useTranscript(sourceId: string | null) {
  return useQuery({
    queryKey: ['transcript', sourceId],
    queryFn: () => sourceId ? fetchTranscript(sourceId) : null,
    enabled: !!sourceId,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
}