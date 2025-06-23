import { useQuery } from '@tanstack/react-query';
import { Segment } from '@/lib/types';

async function fetchTranscript(sourceId: string): Promise<{ segments: Segment[] } | null> {
  try {
    const response = await fetch(`/api/transcripts/${sourceId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error('Failed to fetch transcript');
    }
    return response.json();
  } catch (error) {
    console.error('Error fetching transcript:', error);
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