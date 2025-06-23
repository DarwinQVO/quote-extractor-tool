"use client";

import { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player/youtube";
import { useStore } from "@/lib/store";
import { useTranscription } from "@/hooks/useTranscription";
import { Loader2 } from "lucide-react";
import { extractVideoId } from "@/lib/youtube";

export function ViewerPanel() {
  const playerRef = useRef<ReactPlayer>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  const { 
    activeSourceId, 
    sources, 
    transcripts,
    transcriptionProgress 
  } = useStore();
  
  const activeSource = sources.find(s => s.id === activeSourceId);
  const transcript = activeSourceId ? transcripts.get(activeSourceId) : null;
  const progress = activeSourceId ? transcriptionProgress.get(activeSourceId) || 0 : 0;
  
  useTranscription(activeSourceId);
  
  // Poll for current time
  useEffect(() => {
    if (!playing || !playerRef.current) return;
    
    const interval = setInterval(() => {
      const time = playerRef.current?.getCurrentTime() || 0;
      setCurrentTime(time);
    }, 250);
    
    return () => clearInterval(interval);
  }, [playing]);
  
  const handleSegmentClick = (startTime: number) => {
    playerRef.current?.seekTo(startTime, 'seconds');
  };
  
  const getActiveSegmentIndex = () => {
    if (!transcript) return -1;
    
    return transcript.segments.findIndex(
      seg => currentTime >= seg.start && currentTime < seg.end
    );
  };
  
  const activeSegmentIndex = getActiveSegmentIndex();
  
  // Auto-scroll to active segment
  useEffect(() => {
    if (activeSegmentIndex >= 0) {
      const element = document.getElementById(`segment-${activeSegmentIndex}`);
      element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeSegmentIndex]);

  return (
    <div className="h-full flex flex-col bg-muted/10 border-l border-border">
      <div className="relative aspect-video bg-black">
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
              youtube: {
                playerVars: {
                  modestbranding: 1,
                  rel: 0,
                }
              }
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-muted-foreground">No video loaded</p>
          </div>
        )}
      </div>
      
      <div className="px-6 py-4 border-b border-border">
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
      
      <div className="flex-1 overflow-y-auto p-6">
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
          <div className="space-y-4">
            {transcript.segments.map((segment, index) => {
              const isActive = index === activeSegmentIndex;
              
              return (
                <div
                  key={index}
                  className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                    isActive 
                      ? 'bg-yellow-400/20 ring-2 ring-yellow-400/50' 
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => handleSegmentClick(segment.start)}
                  id={`segment-${index}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-medium text-muted-foreground min-w-[80px]">
                      {segment.speaker}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm leading-relaxed">{segment.text}</p>
                      <span className="text-xs text-muted-foreground mt-1">
                        {formatTime(segment.start)} - {formatTime(segment.end)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">
            Transcript will appear here once the video is processed
          </p>
        )}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}