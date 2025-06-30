"use client";

import React, { useEffect, useRef } from "react";

interface Word {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface WordLevelTranscriptProps {
  words: Word[];
  segments?: TranscriptSegment[];
  currentTime: number;
  onWordClick: (time: number) => void;
}

export function WordLevelTranscript({ words, segments, currentTime, onWordClick }: WordLevelTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  

  // Convert segments to words if words don't have speaker info
  const generateWordsFromSegments = (segments: TranscriptSegment[]): Word[] => {
    const generatedWords: Word[] = [];
    
    segments.forEach(segment => {
      const segmentWords = segment.text.split(/\s+/).filter(w => w.length > 0);
      const segmentDuration = segment.end - segment.start;
      const wordDuration = segmentDuration / segmentWords.length;
      
      segmentWords.forEach((wordText, index) => {
        const wordStart = segment.start + (index * wordDuration);
        const wordEnd = wordStart + wordDuration;
        
        generatedWords.push({
          text: wordText,
          start: wordStart,
          end: wordEnd,
          speaker: segment.speaker
        });
      });
    });
    
    return generatedWords;
  };

  // Determine which words to use
  const hasWordsWithSpeakers = words?.some(w => w.speaker);
  const hasSegmentsWithSpeakers = segments?.some(s => s.speaker);
  
  let effectiveWords: Word[] = words || [];
  
  // If words don't have speaker info but segments do, generate words from segments
  if (!hasWordsWithSpeakers && hasSegmentsWithSpeakers && segments) {
    effectiveWords = generateWordsFromSegments(segments);
  }
  
  // Find the current word index
  const currentWordIndex = effectiveWords.findIndex(word => 
    currentTime >= word.start && currentTime <= word.end
  );

  // Auto-scroll to the current word
  useEffect(() => {
    if (currentWordIndex >= 0 && containerRef.current) {
      const activeWord = containerRef.current.querySelector(`[data-word-index="${currentWordIndex}"]`);
      if (activeWord) {
        activeWord.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentWordIndex]);

  // Group words by speaker and time for better display
  const groupedWords = effectiveWords.reduce((groups: Array<{speaker: string, words: Word[], startTime: number}>, word, index) => {
    const lastGroup = groups[groups.length - 1];
    
    // Start a new group if speaker changes or there's a big time gap
    const speakerChanged = !lastGroup || lastGroup.speaker !== (word.speaker || 'Unknown');
    const timeGap = lastGroup && (word.start - lastGroup.words[lastGroup.words.length - 1].end > 2);
    
    if (speakerChanged || timeGap) {
      groups.push({
        speaker: word.speaker || 'Unknown',
        words: [word],
        startTime: word.start
      });
    } else {
      lastGroup.words.push(word);
    }
    
    return groups;
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div 
      ref={containerRef}
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '20px',
        backgroundColor: '#1a1a1a',
        color: '#e5e5e5',
        fontSize: '16px',
        lineHeight: '1.8',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      {groupedWords.map((group, groupIndex) => (
        <div 
          key={groupIndex}
          style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: '#262626',
            borderRadius: '8px',
            border: '1px solid #404040'
          }}
        >
          {/* Speaker and timestamp */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
            fontSize: '12px',
            color: '#9ca3af'
          }}>
            <span style={{
              fontWeight: '600',
              color: group.speaker === 'Host' ? '#3b82f6' : 
                     group.speaker === 'Interviewer' ? '#10b981' : '#f59e0b'
            }}>
              {group.speaker}
            </span>
            <span style={{ fontFamily: 'monospace' }}>
              {formatTime(group.startTime)}
            </span>
          </div>

          {/* Words */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            alignItems: 'baseline'
          }}>
            {group.words.map((word, wordIndex) => {
              const globalWordIndex = effectiveWords.indexOf(word);
              const isActive = globalWordIndex === currentWordIndex;
              const isPast = currentTime > word.end;
              const isFuture = currentTime < word.start;
              
              return (
                <span
                  key={`${groupIndex}-${wordIndex}`}
                  data-word-index={globalWordIndex}
                  onClick={() => onWordClick(word.start)}
                  style={{
                    padding: '2px 4px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: isActive ? '#2563eb' : 
                                   isPast ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                    color: isActive ? '#ffffff' : 
                           isPast ? '#93c5fd' : 
                           isFuture ? '#6b7280' : '#e5e5e5',
                    fontWeight: isActive ? '600' : '400',
                    transform: isActive ? 'scale(1.05)' : 'scale(1)',
                    boxShadow: isActive ? '0 0 8px rgba(37, 99, 235, 0.5)' : 'none',
                    border: isActive ? '1px solid #3b82f6' : '1px solid transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                      e.currentTarget.style.color = '#bfdbfe';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = isPast ? 'rgba(59, 130, 246, 0.3)' : 'transparent';
                      e.currentTarget.style.color = isPast ? '#93c5fd' : isFuture ? '#6b7280' : '#e5e5e5';
                    }
                  }}
                >
                  {word.text}
                </span>
              );
            })}
          </div>
        </div>
      ))}
      
      {effectiveWords.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#6b7280'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px',
            opacity: 0.5
          }}>
            📝
          </div>
          <p>No word-level transcript available</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            This transcript may only have segment-level timing
          </p>
        </div>
      )}
    </div>
  );
}