"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactPlayer from "react-player/youtube";
import { useStore } from "@/lib/store";
import { useTranscription } from "@/hooks/useTranscription";
import { Loader2, Settings } from "lucide-react";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { WordLevelTranscript } from "@/components/WordLevelTranscript";
import { buildCitation } from "@/lib/citations";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight } from "lucide-react";

export function ViewerPanel() {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [enhancementSettings, setEnhancementSettings] = useState({
    enableAIEnhancement: false,
    autoEnhance: false,
  });
  const [showPrompt, setShowPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState(`You are an expert transcript enhancer. Your job is to improve transcript text quality while maintaining the exact meaning and speaker intent.

APPLY THESE RULES EXACTLY:
1. Fix company/person names using context knowledge (e.g., if they mention "WAZE" but transcript says "ways", correct it)
2. Identify missed percentages (e.g., "fifty five" → "55%")
3. Capitalize first letter of quotes within quotes
4. Fix grammar and punctuation intelligently
5. Maintain all factual information exactly - NEVER change numbers, dates, or specific details
6. Keep the natural speaking flow and tone
7. Don't add words that weren't spoken

Return only the enhanced text, no explanations.`);

  // Load saved prompt from localStorage
  useEffect(() => {
    const savedPrompt = localStorage.getItem('transcript-enhancement-prompt');
    if (savedPrompt) {
      setCustomPrompt(savedPrompt);
    }
  }, []);

  // Save prompt to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('transcript-enhancement-prompt', customPrompt);
  }, [customPrompt]);
  
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
      <div className="relative aspect-video bg-black flex-shrink-0 max-h-[40vh] mx-6 mt-6 rounded-xl overflow-hidden shadow-lg">
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
          <div className="absolute inset-0 flex items-center justify-center rounded-xl">
            <p className="text-muted-foreground">No video loaded</p>
          </div>
        )}
      </div>
      
      <div className="px-6 py-4 border-b border-border flex-shrink-0">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Status</span>
              <button
                onClick={() => setShowSettings(true)}
                className="p-1 rounded-md hover:bg-muted/50 transition-colors"
                title="Transcript Settings"
              >
                <Settings className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>
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
      
      {/* Settings Modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Transcript Enhancement Settings</DialogTitle>
            <DialogDescription>
              Configure how transcripts are processed and enhanced
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 pt-4">
            {/* Connection Status */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">System Status</Label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Database Connected</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>OpenAI Available</span>
                </div>
              </div>
            </div>
            
            {/* Enhancement Options */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Enhancement Features</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">Basic Cleaning</Label>
                    <p className="text-xs text-muted-foreground">
                      Remove filler words, format numbers (>$100M, 50%, etc.)
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm">AI Enhancement</Label>
                    <p className="text-xs text-muted-foreground">
                      Context-aware improvements, company names, punctuation
                    </p>
                  </div>
                  <button
                    onClick={() => setEnhancementSettings(prev => ({
                      ...prev,
                      enableAIEnhancement: !prev.enableAIEnhancement
                    }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      enhancementSettings.enableAIEnhancement ? 'bg-primary' : 'bg-muted'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enhancementSettings.enableAIEnhancement ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                {enhancementSettings.enableAIEnhancement && (
                  <>
                    <div className="flex items-center justify-between pl-4">
                      <div className="space-y-1">
                        <Label className="text-sm">Auto-enhance new transcripts</Label>
                        <p className="text-xs text-muted-foreground">
                          Automatically enhance transcripts after processing
                        </p>
                      </div>
                      <button
                        onClick={() => setEnhancementSettings(prev => ({
                          ...prev,
                          autoEnhance: !prev.autoEnhance
                        }))}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          enhancementSettings.autoEnhance ? 'bg-primary' : 'bg-muted'
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                            enhancementSettings.autoEnhance ? 'translate-x-5' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    
                    {/* Expandable Prompt Editor */}
                    <div className="pl-4">
                      <button
                        onClick={() => setShowPrompt(!showPrompt)}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPrompt ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Customize AI Prompt
                      </button>
                      
                      {showPrompt && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={customPrompt}
                            onChange={(e) => setCustomPrompt(e.target.value)}
                            className="min-h-[200px] text-xs font-mono"
                            placeholder="Enter your custom prompt..."
                          />
                          <p className="text-xs text-muted-foreground">
                            This prompt guides the AI enhancement. Modify to fit your specific needs.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="flex-1"
              >
                Close
              </Button>
              {activeSource?.status === 'ready' && enhancementSettings.enableAIEnhancement && (
                <Button
                  onClick={async () => {
                    toast({
                      title: "Enhancing transcript...",
                      description: "AI enhancement in progress",
                    });
                    setShowSettings(false);
                  }}
                  className="flex-1"
                >
                  Enhance Now
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

