"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import { Segment } from "@/lib/types";
import { groupTranscriptSegments, groupWordsByOptimizedSegments, formatTimeRange } from "@/lib/transcript-grouping";
import { getSimpleSpeakerColors } from "@/lib/simple-speaker-colors";

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
  onSpeakerUpdate: _onSpeakerUpdate
}: WordLevelTranscriptProps) {
  const [selectedWords, setSelectedWords] = useState<number[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  // Speaker editing removed - use Speaker Manager instead
  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });
  const [hasMoved, setHasMoved] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [userScrollTimeout, setUserScrollTimeout] = useState<NodeJS.Timeout | null>(null);
  const prevActiveIndex = useRef(-1);

  // Note: Color initialization happens automatically with the simple system

  // If we don't have word-level data, fallback to segment-based display
  const hasWordLevelData = words && words.length > 0;

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

  // Speaker editing functions removed - use Speaker Manager instead

  // Handle user scroll to pause auto-scroll temporarily
  const handleScroll = () => {
    // Disable auto-scroll when user manually scrolls
    setIsAutoScrollEnabled(false);
    
    // Clear existing timeout
    if (userScrollTimeout) {
      clearTimeout(userScrollTimeout);
    }
    
    // Re-enable auto-scroll after 3 seconds of no scrolling
    const timeout = setTimeout(() => {
      setIsAutoScrollEnabled(true);
    }, 3000);
    
    setUserScrollTimeout(timeout);
  };

  // Auto-scroll implementation that respects user interaction
  useEffect(() => {
    const activeIndex = hasWordLevelData ? activeWordIndex : activeSegmentIndex;
    
    // Only scroll if:
    // 1. Auto-scroll is enabled
    // 2. Active index actually changed
    // 3. We have a valid active index
    if (isAutoScrollEnabled && activeIndex >= 0 && activeIndex !== prevActiveIndex.current) {
      prevActiveIndex.current = activeIndex;
      
      // Use a small delay to ensure DOM is stable
      const timeoutId = setTimeout(() => {
        const element = document.getElementById(hasWordLevelData ? `word-${activeIndex}` : `segment-${activeIndex}`);
        if (element && containerRef.current) {
          const container = containerRef.current;
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          
          // Check if element is out of view within the transcript container
          const isOutOfView = 
            elementRect.top < containerRect.top + 50 || 
            elementRect.bottom > containerRect.bottom - 50;
          
          if (isOutOfView) {
            // Use smooth scrolling within the container only
            element.scrollIntoView({ 
              block: 'center', 
              behavior: 'smooth',
              inline: 'nearest'
            });
          }
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [activeWordIndex, activeSegmentIndex, hasWordLevelData, isAutoScrollEnabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeout) {
        clearTimeout(userScrollTimeout);
      }
    };
  }, [userScrollTimeout]);

  // const formatTime = (seconds: number): string => {
  //   const mins = Math.floor(seconds / 60);
  //   const secs = Math.floor(seconds % 60);
  //   return `${mins}:${secs.toString().padStart(2, '0')}`;
  // };

  // Optimized grouping system - reduces visual jumps and improves flow
  const optimizedGroups = useMemo(() => {
    // Safety check
    if (!segments || segments.length === 0) {
      return [];
    }
    
    if (!hasWordLevelData) {
      // For segment-only mode, use intelligent grouping
      return groupTranscriptSegments(segments).map(groupedSegment => ({
        groupedSegment,
        words: [] as { word: Word; index: number }[],
        speakerColors: { backgroundColor: '', textColor: '', borderColor: '', accentColor: '' }
      }));
    }
    
    // For word-level mode, use optimized word-segment grouping
    return groupWordsByOptimizedSegments(words || [], segments).map((group, groupIndex) => ({
      groupedSegment: group.segment,
      words: group.words.map((word, wordIndex) => ({ 
        word, 
        index: words && words.length > 0 ? words.findIndex(w => w === word) : wordIndex 
      })),
      speakerColors: { backgroundColor: '', textColor: '', borderColor: '', accentColor: '' }
    }));
  }, [words, segments, hasWordLevelData]);

  // Pre-calculate speaker colors for all groups to avoid hook issues
  const groupsWithColors = useMemo(() => {
    return optimizedGroups.map(group => ({
      ...group,
      speakerColors: getSimpleSpeakerColors(group.groupedSegment.speaker)
    }));
  }, [optimizedGroups]);

  if (hasWordLevelData) {

    return (
      <div 
        ref={containerRef}
        className="space-y-4 pb-8 h-full overflow-y-auto"
        onMouseUp={(e) => handleMouseUp(e)}
        onMouseLeave={() => {
          setIsSelecting(false);
          setSelectedWords([]);
          setHasMoved(false);
          setMouseDownTime(0);
        }}
        onScroll={handleScroll}
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
        {groupsWithColors.map((group, groupIndex) => {
          const speakerColors = group.speakerColors;
          
          return (
            <div 
              key={groupIndex} 
              className="rounded-lg p-3 mb-3 transition-all duration-200 border"
              style={{ 
                backgroundColor: speakerColors.backgroundColor,
                borderColor: speakerColors.borderColor 
              }}
            >
              {/* Enhanced Speaker header with colors and group info */}
              <div 
                className="flex items-center justify-between mb-3 pb-2 border-b"
                style={{ borderColor: speakerColors.borderColor }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: speakerColors.accentColor }}
                  ></div>
                  <span 
                    className="font-semibold"
                    style={{ color: speakerColors.textColor }}
                  >
                    {group.groupedSegment.speaker}
                  </span>
                  <span 
                    className="text-xs opacity-70"
                    style={{ color: speakerColors.textColor }}
                  >
                    {formatTimeRange(group.groupedSegment.startTime, group.groupedSegment.endTime)}
                  </span>
                </div>
                {group.groupedSegment.segments.length > 1 && (
                  <span 
                    className="text-xs opacity-60 font-medium"
                    style={{ color: speakerColors.textColor }}
                  >
                    {group.groupedSegment.segments.length} segments • {group.groupedSegment.wordCount} words
                  </span>
                )}
              </div>
            
              {/* Words in this grouped segment con separadores para pausas */}
              <div className="leading-relaxed text-base">
                {group.words.map(({ word, index }, wordIndex) => {
                  const isActive = index === activeWordIndex;
                  const isSelected = isSelecting && selectedWords.includes(index);
                  
                  // Check if there's a significant pause before this word
                  const prevWord = wordIndex > 0 ? group.words[wordIndex - 1].word : null;
                  const hasPause = prevWord && (word.start - prevWord.end) > 0.8; // 0.8+ seconds pause
                  
                  return (
                    <React.Fragment key={index}>
                      {/* Pause indicator - solo líneas */}
                      {hasPause && (
                        <div className="block w-full my-4">
                          <div className="flex items-center">
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-400/60 to-transparent"></div>
                            <div className="mx-4 w-2 h-0.5 bg-gray-400/60"></div>
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-400/60 to-transparent"></div>
                          </div>
                        </div>
                      )}
                      
                      <span
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
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  } else {
    // Fallback to segment-based display
    return (
      <div 
        ref={containerRef} 
        className="space-y-4 pb-8 h-full overflow-y-auto"
        onScroll={handleScroll}
        style={{ 
          scrollBehavior: 'smooth',
          contain: 'layout style paint',
          isolation: 'isolate'
        }}
      >
        {groupsWithColors.map((group, groupIndex) => {
          const speakerColors = group.speakerColors;
          const isActive = group.groupedSegment.segments.some(seg => 
            currentTime >= seg.start && currentTime < seg.end
          );
          
          return (
            <div
              key={groupIndex}
              className={`rounded-lg p-3 mb-3 cursor-pointer transition-all duration-200 border ${
                isActive 
                  ? 'ring-2 ring-yellow-400/50 shadow-md' 
                  : 'hover:shadow-sm'
              }`}
              style={{ 
                backgroundColor: speakerColors.backgroundColor,
                borderColor: speakerColors.borderColor 
              }}
              onClick={() => onWordClick(group.groupedSegment.startTime)}
              id={`group-${groupIndex}`}
            >
              {/* Enhanced Speaker header with colors */}
              <div 
                className="flex items-center justify-between mb-3 pb-2 border-b"
                style={{ borderColor: speakerColors.borderColor }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: speakerColors.accentColor }}
                  ></div>
                  <span 
                    className="font-semibold"
                    style={{ color: speakerColors.textColor }}
                  >
                    {group.groupedSegment.speaker}
                  </span>
                  <span 
                    className="text-xs opacity-70"
                    style={{ color: speakerColors.textColor }}
                  >
                    {formatTimeRange(group.groupedSegment.startTime, group.groupedSegment.endTime)}
                  </span>
                </div>
                {group.groupedSegment.segments.length > 1 && (
                  <span 
                    className="text-xs opacity-60 font-medium"
                    style={{ color: speakerColors.textColor }}
                  >
                    {group.groupedSegment.segments.length} segments • {group.groupedSegment.wordCount} words
                  </span>
                )}
              </div>
              
              {/* Combined text from grouped segments con separadores para pausas */}
              <div className="text-base leading-relaxed">
                {group.groupedSegment.segments.map((segment, segIndex) => {
                  // Check if there's a significant pause before this segment
                  const prevSegment = segIndex > 0 ? group.groupedSegment.segments[segIndex - 1] : null;
                  const hasPause = prevSegment && (segment.start - prevSegment.end) > 0.8; // 0.8+ seconds pause
                  
                  return (
                    <React.Fragment key={segIndex}>
                      {/* Pause indicator - solo líneas */}
                      {hasPause && (
                        <div className="block w-full my-4">
                          <div className="flex items-center">
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-400/60 to-transparent"></div>
                            <div className="mx-4 w-2 h-0.5 bg-gray-400/60"></div>
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-gray-400/60 to-transparent"></div>
                          </div>
                        </div>
                      )}
                      
                      <span style={{ color: speakerColors.textColor, opacity: 0.9 }}>
                        {segment.text}
                        {segIndex < group.groupedSegment.segments.length - 1 ? ' ' : ''}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
}