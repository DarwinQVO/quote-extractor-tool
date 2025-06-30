"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactPlayer from "react-player/youtube";
import { WordLevelTranscript } from "./WordLevelTranscript";

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface Word {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface TranscriptViewerProps {
  videoUrl: string;
  segments: TranscriptSegment[];
  words: Word[];
  title: string;
  onClose: () => void;
}

export function TranscriptViewer({ videoUrl, segments, words, title, onClose }: TranscriptViewerProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef<ReactPlayer>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);


  // Find the active segment based on current time
  useEffect(() => {
    const activeIndex = segments.findIndex(segment => 
      currentTime >= segment.start && currentTime <= segment.end
    );
    setActiveSegmentIndex(activeIndex);

    // Auto-scroll to active segment
    if (activeIndex >= 0 && transcriptRef.current) {
      const activeElement = transcriptRef.current.querySelector(`[data-segment="${activeIndex}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  }, [currentTime, segments]);

  const handleProgress = (state: { playedSeconds: number }) => {
    setCurrentTime(state.playedSeconds);
  };

  const handleWordClick = (time: number) => {
    if (playerRef.current) {
      playerRef.current.seekTo(time, 'seconds');
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: '20px',
        borderBottom: '1px solid #333',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#111'
      }}>
        <h2 style={{ 
          color: 'white', 
          margin: 0, 
          fontSize: '18px',
          maxWidth: '80%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {title}
        </h2>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '5px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '20px',
        padding: '20px',
        overflow: 'hidden'
      }}>
        {/* Video player */}
        <div style={{
          backgroundColor: '#000',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <ReactPlayer
            ref={playerRef}
            url={videoUrl}
            width="100%"
            height="100%"
            controls
            playing={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onProgress={handleProgress}
            progressInterval={100}
          />
        </div>

        {/* Transcript panel */}
        <div style={{
          backgroundColor: '#1a1a1a',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}>
          {/* Transcript header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid #333',
            backgroundColor: '#222'
          }}>
            <h3 style={{ 
              color: 'white', 
              margin: 0, 
              fontSize: '16px',
              fontWeight: '500'
            }}>
              Transcript
            </h3>
            <p style={{ 
              color: '#888', 
              margin: '4px 0 0 0', 
              fontSize: '12px' 
            }}>
              Click on any line to jump to that moment
            </p>
          </div>

          {/* Transcript content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <WordLevelTranscript
              words={words}
              segments={segments}
              currentTime={currentTime}
              onWordClick={handleWordClick}
            />
          </div>

          {/* Controls */}
          <div style={{
            padding: '16px',
            borderTop: '1px solid #333',
            backgroundColor: '#222'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '12px'
            }}>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                {isPlaying ? '⏸️ Pause' : '▶️ Play'}
              </button>
              <button
                onClick={() => {
                  if (playerRef.current) {
                    playerRef.current.seekTo(currentTime - 10, 'seconds');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⏪ -10s
              </button>
              <button
                onClick={() => {
                  if (playerRef.current) {
                    playerRef.current.seekTo(currentTime + 10, 'seconds');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#374151',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                ⏩ +10s
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}