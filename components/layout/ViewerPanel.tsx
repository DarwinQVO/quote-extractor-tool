"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactPlayer from "react-player/youtube";
import { useStore } from "@/lib/store";
import { useTranscription } from "@/hooks/useTranscription";
import { Loader2 } from "lucide-react";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { WordLevelTranscript } from "@/components/WordLevelTranscript";
import { buildCitation } from "@/lib/citations";
import { toast } from "@/hooks/use-toast";

export function ViewerPanel() {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const { 
    activeSourceId, 
    sources, 
    transcripts,
    transcriptionProgress,
    addQuote,
    updateTranscript,
    quotes,
    updateMultipleQuotes
  } = useStore();
  
  const activeSource = sources.find(s => s.id === activeSourceId);
  const transcript = activeSourceId ? transcripts.get(activeSourceId) : null;
  const progress = activeSourceId ? transcriptionProgress.get(activeSourceId) || 0 : 0;
  
  useTranscription(activeSourceId);
  
  // Poll for current time more frequently for word-level sync
  useEffect(() => {
    if (!playing || !playerRef.current) return;
    
    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() || 0;
      setCurrentTime(time);
    }, 50); // Much more frequent for word-level sync
    
    return () => clearInterval(interval);
  }, [playing]);
  
  const handleSegmentClick = (startTime: number) => {
    playerRef.current?.seekTo(startTime, 'seconds');
  };
  
  const handleQuoteAdd = (selectedText: string) => {
    if (!activeSource || !transcript) return;
    
    // Find which segment contains the selected text
    const containingSegment = transcript.segments.find(segment => 
      segment.text.includes(selectedText)
    );
    
    if (!containingSegment) {
      toast({
        title: 'Quote not found',
        description: 'Could not locate the selected text in the transcript',
        variant: 'destructive',
      });
      return;
    }
    
    // Build citation with proper upload date
    const citation = buildCitation(
      activeSource, 
      containingSegment, 
      activeSource.uploadDate, // Use video's actual upload date
      containingSegment.start // Use segment start as precise time for fallback
    );
    
    // Add quote to store
    addQuote({
      sourceId: activeSource.id,
      text: selectedText,
      speaker: containingSegment.speaker,
      startTime: containingSegment.start,
      endTime: containingSegment.end,
      citation: citation.text,
      timestampLink: citation.link,
    });
    
    toast({
      title: 'Quote added',
      description: 'Quote has been added to your collection',
    });
  };

  const handlePreciseQuoteAdd = (selectedText: string, startTime: number, endTime: number, speaker: string) => {
    if (!activeSource) return;
    
    // Create a mock segment for citation
    const mockSegment = {
      speaker,
      start: startTime,
      end: endTime,
      text: selectedText,
    };
    
    // Build citation with proper upload date and precise start time
    const citation = buildCitation(
      activeSource, 
      mockSegment, 
      activeSource.uploadDate,
      startTime // Pass precise start time for accurate timestamp link
    );
    
    // Add quote to store
    addQuote({
      sourceId: activeSource.id,
      text: selectedText,
      speaker: speaker,
      startTime: startTime,
      endTime: endTime,
      citation: citation.text,
      timestampLink: citation.link,
    });
    
    toast({
      title: 'Quote added',
      description: 'Precise quote has been added to your collection',
    });
  };

  const handleSpeakerUpdate = useCallback((originalSpeaker: string, newSpeaker: string) => {
    if (!activeSourceId || !transcript || !activeSource) return;

    // Update transcript segments efficiently
    const updatedSegments = transcript.segments.map(segment => 
      segment.speaker === originalSpeaker 
        ? { ...segment, speaker: newSpeaker }
        : segment
    );

    // Update transcript first
    updateTranscript(activeSourceId, { segments: updatedSegments });

    // Batch update all quotes from this source that use the old speaker name
    const quotesToUpdate = quotes.filter(quote => 
      quote.sourceId === activeSourceId && quote.speaker === originalSpeaker
    );

    if (quotesToUpdate.length > 0) {
      // Prepare batch updates
      const batchUpdates = quotesToUpdate.map(quote => {
        // Rebuild citation with new speaker name
        const mockSegment = {
          speaker: newSpeaker,
          start: quote.startTime,
          end: quote.endTime,
          text: quote.text,
        };

        const updatedCitation = buildCitation(
          activeSource,
          mockSegment,
          activeSource.uploadDate,
          quote.startTime
        );

        return {
          id: quote.id,
          updates: {
            speaker: newSpeaker,
            citation: updatedCitation.text,
            timestampLink: updatedCitation.link,
          }
        };
      });

      // Update all quotes in a single batch operation
      updateMultipleQuotes(batchUpdates);
    }
  }, [activeSourceId, transcript, activeSource, quotes, updateTranscript, updateMultipleQuotes]);

  return (
    <div className="h-full flex flex-col bg-muted/10 border-l border-border">
      <div className="relative aspect-video bg-black flex-shrink-0 max-h-[40vh]">
        {activeSource ? (
          <ReactPlayer
            ref={playerRef}
            url={activeSource.url}
            width="100%"
            height="100%"
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            controls
            config={{
              playerVars: {
                modestbranding: 1,
                rel: 0,
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">No video loaded</p>
          </div>
        )}
      </div>
      
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">
              {!activeSource ? 'Waiting for video...' :
               activeSource.status === 'transcribing' ? 'Transcribing...' :
               activeSource.status === 'ready' ? 'Ready' :
               activeSource.status === 'error' ? 'Error' :
               'Processing...'}
            </span>
          </div>
          {activeSource?.status === 'transcribing' && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 p-6 min-h-0 overflow-hidden">
        {!activeSource ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Select a video from the sources panel to view its transcript
          </p>
        ) : activeSource.status === 'transcribing' ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Transcribing video... {progress}%
            </p>
          </div>
        ) : transcript ? (
          <>
            <WordLevelTranscript
              segments={transcript.segments}
              words={transcript.words}
              currentTime={currentTime}
              onWordClick={handleSegmentClick}
              onTextSelection={handlePreciseQuoteAdd}
              onSpeakerUpdate={handleSpeakerUpdate}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Transcript will appear here once the video is processed
          </p>
        )}
      </div>
      
      <SelectionToolbar onQuoteAdd={handleQuoteAdd} />
    </div>
  );
}

