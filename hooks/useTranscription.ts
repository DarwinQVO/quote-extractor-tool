import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStore } from '@/lib/store';
import { Segment } from '@/lib/types';
import { toast } from './use-toast';
import { useTranscript } from './useTranscript';

export function useTranscription(sourceId: string | null) {
  const queryClient = useQueryClient();
  const { 
    updateSource, 
    setTranscript, 
    setTranscriptionProgress,
    sources 
  } = useStore();
  
  const source = sources.find(s => s.id === sourceId);
  const { data: existingTranscript } = useTranscript(sourceId);
  
  const startTranscription = useCallback(async () => {
    if (!sourceId || !source) return;
    
    // Check if we have a cached transcript first
    if (existingTranscript?.segments) {
      setTranscript(sourceId, {
        sourceId,
        segments: existingTranscript.segments,
        words: existingTranscript.words,
        speakers: existingTranscript.speakers,
      });
      updateSource(sourceId, { 
        status: 'ready',
        transcriptStatus: 'ready'
      });
      
      toast({
        title: 'Transcript loaded',
        description: 'Using cached transcript from previous session',
      });
      return;
    }
    
    try {
      updateSource(sourceId, { 
        status: 'transcribing',
        transcriptStatus: 'transcribing'
      });
      
      // Start SSE for progress updates
      const eventSource = new EventSource(`/api/transcribe/status?id=${sourceId}`);
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setTranscriptionProgress(sourceId, data.progress);
        
        // Update source status with enhanced progress info
        if (data.status && data.stage) {
          updateSource(sourceId, { 
            transcriptStatus: data.status === 'completed' ? 'ready' : 'transcribing',
            transcriptStage: data.stage,
            transcriptMessage: data.message
          });
        }
      };
      
      eventSource.onerror = () => {
        eventSource.close();
      };
      
      // Start complete video processing (metadata + transcript)
      const response = await fetch('/api/video-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, url: source.url }),
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const result = await response.json();
      
      // Handle new video-processor response format
      if (result.video && result.transcript) {
        console.log('✅ Video processed successfully:', result.video.title);
        
        // Update source with metadata
        updateSource(sourceId, {
          title: result.video.title,
          channel: result.video.channel,
          duration: result.video.duration,
          thumbnail: result.video.thumbnail,
          status: 'ready',
          transcriptStatus: 'ready'
        });
        
        // Load the transcript that was just saved
        const transcriptResponse = await fetch(`/api/transcripts/${sourceId}`);
        if (transcriptResponse.ok) {
          const transcriptData = await transcriptResponse.json();
          
          setTranscript(sourceId, {
            sourceId,
            segments: transcriptData.segments || [],
            words: transcriptData.words || [],
            speakers: transcriptData.speakers || [],
          });
        }
        
        toast({
          title: 'Processing complete',
          description: `Video "${result.video.title}" has been processed successfully`,
        });
        
        eventSource.close();
        return;
      }
      
      // Handle legacy response format
      const { segments, words, speakers, cached } = result;
      
      // Store transcript
      setTranscript(sourceId, {
        sourceId,
        segments: segments as Segment[],
        words: words || [],
        speakers: speakers || [],
      });
      
      updateSource(sourceId, { 
        status: 'ready',
        transcriptStatus: 'ready'
      });
      
      // Invalidate React Query cache to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ['transcript', sourceId] });
      
      toast({
        title: cached ? 'Transcript loaded' : 'Transcription complete',
        description: cached 
          ? 'Using cached transcript from previous session'
          : 'Your video has been transcribed successfully',
      });
      
      eventSource.close();
    } catch (error: any) {
      console.error('Transcription error:', error);
      
      // Try to parse error details from the response
      let errorDetails = 'Failed to transcribe video';
      let errorSuggestion = 'Please try again later';
      
      if (error.response) {
        try {
          const errorData = await error.response.json();
          if (errorData.details) errorDetails = errorData.details;
          if (errorData.suggestion) errorSuggestion = errorData.suggestion;
          
          console.error('Server error details:', errorData);
        } catch (e) {
          // If we can't parse the error, use the default message
        }
      }
      
      updateSource(sourceId, { 
        status: 'error',
        transcriptStatus: 'error',
        error: errorDetails
      });
      
      toast({
        title: 'Transcription failed',
        description: errorSuggestion,
        variant: 'destructive',
      });
    }
  }, [sourceId, source, updateSource, setTranscript, setTranscriptionProgress, queryClient, existingTranscript]);
  
  // Auto-start transcription when source is added
  useEffect(() => {
    if (source && source.status === 'pending') {
      startTranscription();
    }
  }, [source, startTranscription]);
  
  return { startTranscription };
}