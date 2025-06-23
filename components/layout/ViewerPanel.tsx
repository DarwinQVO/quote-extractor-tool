"use client";

import { useState } from "react";
import ReactPlayer from "react-player/youtube";

export function ViewerPanel() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  return (
    <div className="h-full flex flex-col bg-muted/10 border-l border-border">
      <div className="relative aspect-video bg-black">
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-muted-foreground">No video loaded</p>
        </div>
      </div>
      
      <div className="px-6 py-4 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium">Waiting for video...</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6">
        <div className="prose prose-sm max-w-none">
          <p className="text-sm text-muted-foreground text-center py-8">
            Transcript will appear here once a video is loaded and processed.
          </p>
        </div>
      </div>
    </div>
  );
}