import { useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { Segment } from '@/lib/types';
import { toast } from './use-toast';

export function useTranscription(sourceId: string | null) {
  const { 
    updateSource, 
    setTranscript, 
    setTranscriptionProgress,
    sources 
  } = useStore();
  
  const source = sources.find(s => s.id === sourceId);
  
  const startTranscription = useCallback(async () => {
    if (!sourceId || !source) return;
    
    try {
      updateSource(sourceId, { status: 'transcribing' });
      
      // Start SSE for progress updates
      const eventSource = new EventSource(`/api/transcribe/status?id=${sourceId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setTranscriptionProgress(sourceId, data.progress);
      };
      
      eventSource.onerror = () => {
        eventSource.close();
      };
      
      // Start transcription
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, url: source.url }),
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const { segments, cached } = await response.json();
      
      // Store transcript
      setTranscript(sourceId, {
        sourceId,
        segments: segments as Segment[],
      });
      
      updateSource(sourceId, { status: 'ready' });
      
      toast({
        title: cached ? 'Transcript loaded' : 'Transcription complete',
        description: cached 
          ? 'Using cached transcript from previous session'
          : 'Your video has been transcribed successfully',
      });
      
      eventSource.close();
    } catch (error) {
      console.error('Transcription error:', error);
      updateSource(sourceId, { 
        status: 'error',
        error: 'Failed to transcribe video'
      });
      
      toast({
        title: 'Transcription failed',
        description: 'Please try again later',
        variant: 'destructive',
      });
    }
  }, [sourceId, source, updateSource, setTranscript, setTranscriptionProgress]);
  
  // Auto-start transcription when source is added
  useEffect(() => {
    if (source && source.status === 'pending') {
      startTranscription();
    }
  }, [source, startTranscription]);
  
  return { startTranscription };
}