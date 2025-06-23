"use client";

import { useState, useRef, useMemo } from "react";
import { Clock, Edit3, Check, X } from "lucide-react";
import { Segment } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface Word {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface WordLevelTranscriptProps {
  segments: Segment[];
  words?: Word[];
  currentTime: number;
  onWordClick: (time: number) => void;
  onTextSelection: (selectedText: string, startTime: number, endTime: number, speaker: string) => void;
  onSpeakerUpdate?: (originalSpeaker: string, newSpeaker: string) => void;
}

export function WordLevelTranscript({ 
  segments, 
  words = [], 
  currentTime, 
  onWordClick, 
  onTextSelection,
  onSpeakerUpdate
}: WordLevelTranscriptProps) {
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // If we don't have word-level data, fallback to segment-based display
  const hasWordLevelData = words.length > 0;

  // Get active word index
  const getActiveWordIndex = () => {
    if (!hasWordLevelData) return -1;
    return words.findIndex(word => currentTime >= word.start && currentTime < word.end);
  };

  // Get active segment index
  const getActiveSegmentIndex = () => {
    return segments.findIndex(seg => currentTime >= seg.start && currentTime < seg.end);
  };

  const activeWordIndex = getActiveWordIndex();
  const activeSegmentIndex = getActiveSegmentIndex();

  // Handle word selection
  const handleWordMouseDown = (wordIndex: number, e: React.MouseEvent) => {
    // Only handle left click
    if (e.button !== 0) return;
    
    // Record mouse down time and position
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });
    setHasMoved(false);
    
    // Start potential selection (but don't commit yet)
    setSelectedWords([wordIndex]);
  };

  const handleWordMouseEnter = (wordIndex: number, e: React.MouseEvent) => {
    // Check if mouse has moved significantly from initial position
    if (selectedWords.length > 0 && !hasMoved) {
      const moveDistance = Math.sqrt(
        Math.pow(e.clientX - mouseDownPos.x, 2) + 
        Math.pow(e.clientY - mouseDownPos.y, 2)
      );
      
      // If moved more than 5 pixels, consider it a drag
      if (moveDistance > 5) {
        setHasMoved(true);
        setIsSelecting(true);
      }
    }
    
    // Only extend selection if we're actively selecting (dragging)
    if (isSelecting && selectedWords.length > 0) {
      const startIndex = Math.min(selectedWords[0], wordIndex);
      const endIndex = Math.max(selectedWords[0], wordIndex);
      const range = Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);
      setSelectedWords(range);
    }
  };

  const handleMouseUp = (e: React.MouseEvent, wordIndex?: number) => {
    const mouseUpTime = Date.now();
    const timeDiff = mouseUpTime - mouseDownTime;
    
    // Prevent event bubbling to avoid double handling
    e.stopPropagation();
    
    if (isSelecting && hasMoved && !isCreatingQuote) {
      // This was a drag - create quote from selection
      if (selectedWords.length > 0) {
        setIsCreatingQuote(true);
        createQuoteFromSelection();
        setTimeout(() => setIsCreatingQuote(false), 500); // Prevent double creation
      }
    } else if (selectedWords.length > 0 && !hasMoved && timeDiff < 300) {
      // This was a quick click - seek to that word's timestamp
      const clickedWordIndex = wordIndex !== undefined ? wordIndex : selectedWords[0];
      if (hasWordLevelData && words[clickedWordIndex]) {
        onWordClick(words[clickedWordIndex].start);
      }
    }
    
    // Reset all selection states
    setIsSelecting(false);
    setSelectedWords([]);
    setHasMoved(false);
    setMouseDownTime(0);
  };

  const createQuoteFromSelection = () => {
    if (selectedWords.length === 0) return;

    if (hasWordLevelData) {
      // Word-level selection
      const selectedWordObjects = selectedWords.map(index => words[index]).filter(Boolean);
      if (selectedWordObjects.length === 0) return;

      const selectedText = selectedWordObjects.map(word => word.text).join(' ').trim();
      const startTime = selectedWordObjects[0].start;
      const endTime = selectedWordObjects[selectedWordObjects.length - 1].end;
      
      // Find primary speaker (the one with the most words in selection)
      const speakerCounts: Record<string, number> = {};
      selectedWordObjects.forEach(wordObj => {
        const containingSegment = segments.find(seg => 
          wordObj.start >= seg.start && wordObj.start < seg.end
        );
        const speaker = containingSegment?.speaker || 'Unknown';
        speakerCounts[speaker] = (speakerCounts[speaker] || 0) + 1;
      });
      
      const primarySpeaker = Object.entries(speakerCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Unknown';

      onTextSelection(selectedText, startTime, endTime, primarySpeaker);
    } else {
      // Fallback to segment-based selection
      const segment = segments[selectedWords[0]];
      if (segment) {
        onTextSelection(segment.text, segment.start, segment.end, segment.speaker);
      }
    }

    setSelectedWords([]);
  };

  // Speaker editing functions
  const handleSpeakerEdit = (speaker: string) => {
    setEditingSpeaker(speaker);
    setEditValue(speaker);
  };

  const handleSpeakerSave = () => {
    if (!editingSpeaker || !editValue.trim()) {
      setEditingSpeaker(null);
      setEditValue("");
      return;
    }

    if (editValue.trim() === editingSpeaker) {
      setEditingSpeaker(null);
      setEditValue("");
      return;
    }

    // Store scroll position before update
    const scrollTop = containerRef.current?.scrollTop || 0;

    // Clear editing state first to prevent re-render conflicts
    const originalSpeaker = editingSpeaker;
    const newSpeaker = editValue.trim();
    setEditingSpeaker(null);
    setEditValue("");

    // Then update speaker
    if (onSpeakerUpdate) {
      // Use setTimeout to avoid blocking the UI
      setTimeout(() => {
        onSpeakerUpdate(originalSpeaker, newSpeaker);
        
        // Restore scroll position after update
        setTimeout(() => {
          if (containerRef.current) {
            containerRef.current.scrollTop = scrollTop;
          }
        }, 50);
        
        toast({
          title: "Speaker updated",
          description: `All segments updated from "${originalSpeaker}" to "${newSpeaker}"`,
        });
      }, 10);
    }
  };

  const handleSpeakerCancel = () => {
    setEditingSpeaker(null);
    setEditValue("");
  };

  const handleSpeakerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSpeakerSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleSpeakerCancel();
    }
  };

  // Auto-scroll disabled to prevent scroll conflicts
  // TODO: Re-implement auto-scroll in a way that doesn't interfere with manual scrolling
  
  /*
  // Ref to track previous active index to prevent unnecessary scrolling
  const prevActiveIndex = useRef(-1);
  
  // Auto-scroll only when active index actually changes
  useEffect(() => {
    const activeIndex = hasWordLevelData ? activeWordIndex : activeSegmentIndex;
    
    // Only scroll if the active index actually changed
    if (activeIndex >= 0 && activeIndex !== prevActiveIndex.current) {
      prevActiveIndex.current = activeIndex;
      
      // Use a small delay to ensure DOM is stable
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(hasWordLevelData ? `word-${activeIndex}` : `segment-${activeIndex}`);
        if (element && containerRef.current) {
          const container = containerRef.current;
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          
          // Only scroll if element is out of view within the transcript container
          const isOutOfView = 
            elementRect.top < containerRect.top || 
            elementRect.bottom > containerRect.bottom;
          
          if (isOutOfView) {
            // Use smooth scrolling within the container only
            element.scrollIntoView({ 
              block: 'nearest', 
              behavior: 'smooth',
              inline: 'nearest'
            });
          }
        }
      }, 50);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeWordIndex, activeSegmentIndex, hasWordLevelData]);
  */

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Memoize expensive wordsBySegment calculation
  const wordsBySegment = useMemo(() => {
    if (!hasWordLevelData) return [];
    
    const result: Array<{ segment: Segment; words: { word: Word; index: number }[] }> = [];
    let currentSegmentIndex = 0;
    let currentSegmentWords: { word: Word; index: number }[] = [];

    words.forEach((word, index) => {
      // Check if we need to move to the next segment
      while (currentSegmentIndex < segments.length - 1 && 
             word.start >= segments[currentSegmentIndex + 1].start) {
        // Save current segment's words if any
        if (currentSegmentWords.length > 0) {
          result.push({
            segment: segments[currentSegmentIndex],
            words: currentSegmentWords
          });
          currentSegmentWords = [];
        }
        currentSegmentIndex++;
      }
      
      // Add word to current segment
      currentSegmentWords.push({ word, index });
    });

    // Add the last segment
    if (currentSegmentWords.length > 0 && currentSegmentIndex < segments.length) {
      result.push({
        segment: segments[currentSegmentIndex],
        words: currentSegmentWords
      });
    }
    
    return result;
  }, [words, segments, hasWordLevelData]);

  if (hasWordLevelData) {

    return (
      <div 
        ref={containerRef}
        className="space-y-6 pb-8 h-full overflow-y-auto"
        onMouseUp={(e) => handleMouseUp(e)}
        onMouseLeave={() => {
          setIsSelecting(false);
          setSelectedWords([]);
          setHasMoved(false);
          setMouseDownTime(0);
        }}
        style={{ 
          scrollBehavior: 'smooth',
          contain: 'layout style paint',
          isolation: 'isolate'
        }}
      >
        {/* Selection indicator - only show when actively selecting (dragging) */}
        {isSelecting && selectedWords.length > 0 && (
          <div className="fixed top-4 right-4 bg-blue-500/90 text-white px-3 py-2 rounded-lg shadow-lg z-50">
            <span className="text-sm font-medium">
              {selectedWords.length} word{selectedWords.length !== 1 ? 's' : ''} selected
            </span>
            <div className="text-xs opacity-80">Release to create quote</div>
          </div>
        )}
        {wordsBySegment.map((segmentGroup, segmentIndex) => (
          <div key={segmentIndex} className="space-y-2">
            {/* Speaker header with editing capability */}
            <div className="flex items-center gap-2 text-sm font-semibold text-primary border-l-2 border-primary pl-3">
              {editingSpeaker === segmentGroup.segment.speaker ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={handleSpeakerKeyDown}
                    className="h-6 px-2 py-0 text-sm border-primary focus:ring-1 focus:ring-primary font-semibold"
                    style={{ width: `${Math.max(editValue.length * 9, 80)}px` }}
                    autoFocus
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleSpeakerSave}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={handleSpeakerCancel}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => handleSpeakerEdit(segmentGroup.segment.speaker)}
                  className="hover:bg-primary/10 px-2 py-1 rounded transition-colors flex items-center gap-1 group"
                  title="Click to edit speaker name"
                >
                  <span>{segmentGroup.segment.speaker}</span>
                  <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                </button>
              )}
              <span className="text-muted-foreground text-xs">
                {formatTime(segmentGroup.segment.start)}
              </span>
            </div>
            
            {/* Words in this segment */}
            <div className="leading-relaxed">
              {segmentGroup.words.map(({ word, index }) => {
                const isActive = index === activeWordIndex;
                const isSelected = isSelecting && selectedWords.includes(index);

                return (
                  <span
                    key={index}
                    id={`word-${index}`}
                    className={`inline-block px-1 py-0.5 mx-0.5 rounded cursor-pointer transition-all duration-150 select-none ${
                      isActive 
                        ? 'bg-yellow-400/40 ring-2 ring-yellow-400/60 shadow-sm' 
                        : isSelected
                        ? 'bg-blue-400/40 ring-2 ring-blue-400/60'
                        : 'hover:bg-muted/60'
                    }`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleWordMouseDown(index, e);
                    }}
                    onMouseEnter={(e) => handleWordMouseEnter(index, e)}
                    onMouseUp={(e) => {
                      e.preventDefault();
                      handleMouseUp(e, index);
                    }}
                  >
                    {word.text}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  } else {
    // Fallback to segment-based display
    return (
      <div 
        ref={containerRef} 
        className="space-y-3 pb-8 h-full overflow-y-auto"
        style={{ 
          scrollBehavior: 'smooth',
          contain: 'layout style paint',
          isolation: 'isolate'
        }}
      >
        {segments.map((segment, index) => {
          const isActive = index === activeSegmentIndex;
          const isSelected = selectedWords.includes(index);
          
          return (
            <div
              key={index}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                isActive 
                  ? 'bg-yellow-400/20 ring-2 ring-yellow-400/50' 
                  : isSelected
                  ? 'bg-blue-400/20 ring-2 ring-blue-400/50'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onWordClick(segment.start)}
              onMouseDown={(e) => handleWordMouseDown(index, e)}
              id={`segment-${index}`}
            >
              <div className="flex items-start gap-3">
                <div className="text-xs font-semibold text-primary min-w-[100px] flex-shrink-0">
                  {editingSpeaker === segment.speaker ? (
                    <div className="flex items-center gap-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleSpeakerKeyDown}
                        className="h-5 px-1 py-0 text-xs border-primary focus:ring-1 focus:ring-primary font-semibold"
                        style={{ width: `${Math.max(editValue.length * 7, 60)}px` }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={handleSpeakerSave}
                      >
                        <Check className="w-2.5 h-2.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        onClick={handleSpeakerCancel}
                      >
                        <X className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSpeakerEdit(segment.speaker)}
                      className="hover:bg-primary/10 px-1 py-0.5 rounded transition-colors flex items-center gap-1 group"
                      title="Click to edit speaker name"
                    >
                      <span>{segment.speaker}</span>
                      <Edit3 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </button>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
                  <span className="text-xs text-muted-foreground mt-1 block flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTime(segment.start)} - {formatTime(segment.end)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}