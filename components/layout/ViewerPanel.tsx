"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactPlayer from "react-player/youtube";
import { useStore } from "@/lib/store";
import { useTranscription } from "@/hooks/useTranscription";
import { useVideoValidator } from "@/hooks/useVideoValidator";
import { Loader2, Settings, Users, AlertTriangle, RefreshCw } from "lucide-react";
import { SelectionToolbar } from "@/components/SelectionToolbar";
import { WordLevelTranscript } from "@/components/WordLevelTranscript";
import { buildCitation } from "@/lib/citations";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SpeakerManager } from "@/components/SpeakerManager";

export function ViewerPanel() {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showSpeakerManager, setShowSpeakerManager] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [enhancementSettings, setEnhancementSettings] = useState({
    enableAIEnhancement: false,
    autoEnhance: false,
  });
  const [showPrompt, setShowPrompt] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancementProgress, setEnhancementProgress] = useState(0);
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

  const handleEnhanceTranscript = async () => {
    if (!activeSourceId || !transcript || isEnhancing) return;
    
    setIsEnhancing(true);
    setEnhancementProgress(0);
    setShowSettings(false);
    
    try {
      const totalSegments = transcript.segments.length;
      const enhancedSegments = [];
      
      toast({
        title: "Enhancing transcript...",
        description: `Processing ${totalSegments} segments with AI`,
      });
      
      // Process segments in batches to show progress
      for (let i = 0; i < transcript.segments.length; i++) {
        const segment = transcript.segments[i];
        
        try {
          const response = await fetch('/api/enhance-transcript', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: segment.text,
              customPrompt,
              context: {
                title: activeSource?.title,
                channel: activeSource?.channel,
                speakers: transcript.speakers?.map(s => s.label),
                topic: activeSource?.description
              }
            }),
          });
          
          if (response.ok) {
            const { enhancedText } = await response.json();
            enhancedSegments.push({
              ...segment,
              text: enhancedText || segment.text
            });
          } else {
            // Log error details for debugging
            const errorText = await response.text();
            console.error(`Enhancement failed for segment ${i}:`, response.status, errorText);
            // Fallback to original text on error
            enhancedSegments.push(segment);
          }
        } catch (error) {
          console.warn('Enhancement failed for segment:', error);
          enhancedSegments.push(segment);
        }
        
        // Update progress
        const progress = Math.round(((i + 1) / totalSegments) * 100);
        setEnhancementProgress(progress);
        
        // Small delay to prevent API rate limiting
        if (i < transcript.segments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Count successful enhancements
      const enhancedCount = enhancedSegments.filter((seg, i) => 
        seg.text !== transcript.segments[i].text
      ).length;
      
      // Update the transcript with enhanced segments
      const enhancedTranscript = {
        ...transcript,
        segments: enhancedSegments
      };
      
      // Update the store with enhanced transcript
      setTranscript(activeSourceId, enhancedTranscript);
      
      if (enhancedCount > 0) {
        toast({
          title: "Enhancement complete!",
          description: `Successfully enhanced ${enhancedCount} of ${totalSegments} segments`,
        });
      } else {
        toast({
          title: "Enhancement complete",
          description: "No changes were needed for this transcript",
        });
      }
      
    } catch (error) {
      console.error('Enhancement error:', error);
      toast({
        title: "Enhancement failed",
        description: "Failed to enhance transcript. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
      setEnhancementProgress(0);
    }
  };
  
  const { 
    activeSourceId, 
    sources, 
    transcripts,
    transcriptionProgress,
    addQuote,
    updateTranscript,
    setTranscript,
    quotes,
    updateMultipleQuotes,
    updateSource
  } = useStore();
  
  const activeSource = sources.find(s => s.id === activeSourceId);
  const transcript = activeSourceId ? transcripts.get(activeSourceId) : null;
  const progress = activeSourceId ? transcriptionProgress.get(activeSourceId) || 0 : 0;
  
  // Debug logging and transcript loading fix
  useEffect(() => {
    console.log('🔍 ViewerPanel state update:', {
      activeSourceId,
      hasTranscript: !!transcript,
      transcriptSegments: transcript?.segments?.length || 0,
      transcriptWords: transcript?.words?.length || 0,
      transcriptsInStore: transcripts.size,
      allTranscriptIds: Array.from(transcripts.keys())
    });
    
    // ENTERPRISE FIX: Force load transcript if missing but source exists
    if (activeSourceId && !transcript && activeSource?.transcriptStatus === 'ready') {
      console.log('🔧 ENTERPRISE FIX: Force loading missing transcript for ready source');
      const loadMissingTranscript = async () => {
        try {
          const response = await fetch(`/api/transcripts/${activeSourceId}`);
          if (response.ok) {
            const transcriptData = await response.json();
            setTranscript(activeSourceId, {
              sourceId: activeSourceId,
              segments: transcriptData.segments || [],
              words: transcriptData.words || [],
              speakers: transcriptData.speakers || [],
            });
            console.log('✅ ENTERPRISE FIX: Missing transcript loaded and set');
          }
        } catch (error) {
          console.error('❌ ENTERPRISE FIX: Failed to load missing transcript:', error);
        }
      };
      loadMissingTranscript();
    }
  }, [activeSourceId, transcript, transcripts, activeSource, setTranscript]);
  
  // Initialize video validator
  const { validateVideo, isValidating, retryVideoLoad, forceVideoRefresh } = useVideoValidator();
  
  useTranscription(activeSourceId);

  // Video validation and synchronization
  useEffect(() => {
    if (activeSource && activeSource.transcriptStatus === 'ready' && activeSource.videoStatus !== 'ready') {
      // Transcript is ready but video status is not validated - validate now
      validateVideo(activeSource);
    }
  }, [activeSource, validateVideo]);

  // Handle video player events
  const handleVideoReady = useCallback(() => {
    setVideoReady(true);
    setVideoError(null);
    
    if (activeSourceId) {
      updateSource(activeSourceId, { 
        videoStatus: 'ready',
        videoError: undefined,
        lastVideoCheck: new Date()
      });
    }
  }, [activeSourceId, updateSource]);

  const handleVideoError = useCallback((error: any) => {
    console.error('ReactPlayer error:', error);
    setVideoReady(false);
    
    const errorMessage = error?.message || 'Video failed to load';
    setVideoError(errorMessage);
    
    if (activeSourceId) {
      updateSource(activeSourceId, { 
        videoStatus: 'error',
        videoError: errorMessage,
        videoRetryCount: (activeSource?.videoRetryCount || 0) + 1
      });

      toast({
        title: 'Video Loading Error',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Auto-retry if under limit
      if ((activeSource?.videoRetryCount || 0) < 2) {
        setTimeout(() => {
          retryVideoLoad(activeSourceId);
        }, 3000);
      }
    }
  }, [activeSourceId, activeSource, updateSource, retryVideoLoad]);

  const handleVideoBuffer = useCallback(() => {
    // Reset error state on buffer (video is loading)
    if (videoError) {
      setVideoError(null);
    }
  }, [videoError]);
  
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
          <>
            <ReactPlayer
              ref={playerRef}
              url={activeSource.url}
              width="100%"
              height="100%"
              playing={playing}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onReady={handleVideoReady}
              onError={handleVideoError}
              onBuffer={handleVideoBuffer}
              onBufferEnd={() => setVideoError(null)}
              controls
              config={{
                playerVars: {
                  modestbranding: 1,
                  rel: 0,
                }
              }}
            />
            
            {/* Video Status Overlay */}
            {(isValidating || activeSource.videoStatus === 'loading') && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <div className="flex items-center gap-3 text-white">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Validating video access...</span>
                </div>
              </div>
            )}
            
            {activeSource.videoStatus === 'error' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <div className="text-center text-white space-y-3">
                  <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto" />
                  <div>
                    <p className="font-medium">Video Loading Error</p>
                    <p className="text-sm text-gray-300">{activeSource.videoError}</p>
                  </div>
                  <Button
                    onClick={() => retryVideoLoad(activeSource.id)}
                    variant="outline"
                    size="sm"
                    className="text-black"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                </div>
              </div>
            )}
            
            {activeSource.videoStatus === 'unavailable' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-xl">
                <div className="text-center text-white space-y-3">
                  <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
                  <div>
                    <p className="font-medium">Video Unavailable</p>
                    <p className="text-sm text-gray-300">
                      This video cannot be accessed, but transcript is available
                    </p>
                  </div>
                  <Button
                    onClick={() => forceVideoRefresh(activeSource.id)}
                    variant="outline"
                    size="sm"
                    className="text-black"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Check Again
                  </Button>
                </div>
              </div>
            )}
          </>
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
              {transcript && (
                <button
                  onClick={() => setShowSpeakerManager(true)}
                  className="p-1 rounded-md hover:bg-muted/50 transition-colors"
                  title="Manage Speakers"
                >
                  <Users className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <span className="font-medium">
              {isEnhancing ? 'Enhancing...' :
               !activeSource ? 'Waiting for video...' :
               activeSource.status === 'transcribing' ? 'Transcribing...' :
               activeSource.status === 'ready' ? 'Ready' :
               activeSource.status === 'error' ? 'Error' :
               'Processing...'}
            </span>
          </div>
          {(activeSource?.status === 'transcribing' || isEnhancing) && (
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div 
                className="h-full transition-all duration-300 ease-out"
                style={{ 
                  width: `${isEnhancing ? enhancementProgress : progress}%`,
                  backgroundColor: isEnhancing ? '#10b981' : 'hsl(var(--primary))'
                }}
              />
            </div>
          )}
          {isEnhancing && (
            <div className="text-xs text-muted-foreground">
              Enhancing transcript: {enhancementProgress}%
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
            {/* ENTERPRISE DEBUG: Show transcript info */}
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
              <div className="font-medium text-green-800 mb-1">✅ Transcript Loaded</div>
              <div className="text-green-700">
                Segments: {transcript.segments?.length || 0} | 
                Words: {transcript.words?.length || 0} | 
                Duration: {Math.round(transcript.duration || 0)}s
              </div>
            </div>
            
            <WordLevelTranscript
              segments={transcript.segments}
              words={transcript.words}
              currentTime={currentTime}
              onWordClick={handleSegmentClick}
              onTextSelection={handlePreciseQuoteAdd}
              onSpeakerUpdate={handleSpeakerUpdate}
            />
          </>
        ) : activeSource?.transcriptStatus === 'ready' ? (
          <div className="text-center py-8">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
              <div className="font-medium text-yellow-800 mb-1">⚠️ Transcript Missing</div>
              <div className="text-yellow-700">
                Source status: {activeSource.transcriptStatus} | 
                Source ID: {activeSourceId} | 
                Store has: {transcripts.size} transcripts
              </div>
            </div>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Page
            </button>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
              <div className="font-medium text-blue-800 mb-1">ℹ️ Status Info</div>
              <div className="text-blue-700">
                {activeSource ? (
                  <>Status: {activeSource.status} | Transcript: {activeSource.transcriptStatus}</>
                ) : (
                  "No source selected"
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Transcript will appear here once the video is processed
            </p>
          </div>
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
                      Remove filler words, format numbers (&gt;$100M, 50%, etc.)
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
                  onClick={handleEnhanceTranscript}
                  disabled={isEnhancing}
                  className="flex-1"
                >
                  {isEnhancing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enhancing...
                    </>
                  ) : (
                    'Enhance Now'
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Speaker Manager Modal */}
      <Dialog open={showSpeakerManager} onOpenChange={setShowSpeakerManager}>
        <DialogContent className="max-w-lg p-0 max-h-[80vh] overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Manage Speakers</DialogTitle>
            <DialogDescription>
              Rename speakers in the transcript
            </DialogDescription>
          </DialogHeader>
          <SpeakerManager 
            sourceId={activeSourceId} 
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

