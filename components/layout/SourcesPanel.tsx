"use client";

import { Plus, Youtube, X, Loader2, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { fetchYouTubeMetadata } from "@/lib/youtube";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function SourcesPanel() {
  const { sources, activeSourceId, addSource, updateSource, removeSource, setActiveSource } = useStore();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const clearAllData = () => {
    if (confirm('¿Estás seguro? Esto borrará todos los videos, transcripts y quotes guardados.')) {
      localStorage.clear();
      window.location.reload();
    }
  };
  
  const handleAddSource = async () => {
    if (!url.trim()) {
      toast({
        title: "Error",
        description: "Please enter a YouTube URL",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const sourceId = addSource(url);
      
      const metadata = await fetchYouTubeMetadata(url);
      
      updateSource(sourceId, {
        title: metadata.title,
        channel: metadata.channel,
        duration: metadata.duration,
        thumbnail: metadata.thumbnail,
        description: metadata.description,
        uploadDate: metadata.uploadDate ? new Date(metadata.uploadDate) : undefined,
        viewCount: metadata.viewCount,
        status: 'pending',
      });
      
      setUrl("");
      setIsDialogOpen(false);
      
      toast({
        title: "Success",
        description: "Video added successfully",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to fetch video metadata",
        variant: "destructive",
      });
      
      updateSource(sources[sources.length - 1]?.id || '', {
        status: 'error',
        error: 'Failed to fetch metadata',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-muted/30 border-r border-border">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold mb-4">Sources</h2>
        <Button 
          onClick={() => setIsDialogOpen(true)}
          className="w-full gap-2 mb-2"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          Add YouTube URL
        </Button>
        
        {sources.length > 0 && (
          <Button 
            onClick={clearAllData}
            variant="outline" 
            className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            size="sm"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </Button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {sources.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No sources added yet. Add a YouTube URL to get started.
          </p>
        ) : (
          sources.map((source) => (
            <div
              key={source.id}
              className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
                activeSourceId === source.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/50'
              }`}
              onClick={() => setActiveSource(source.id)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Eliminar "${source.title}"? Esto borrará el video, transcript y todas las quotes asociadas.`)) {
                    removeSource(source.id);
                  }
                }}
                className="absolute top-2 right-2 p-1 rounded-lg hover:bg-background/80 transition-colors"
                title="Eliminar video y transcript"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  {source.status === 'fetching-metadata' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Youtube className="w-6 h-6" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate pr-6">{source.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{source.channel}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {source.status === 'ready' ? 'Ready' : 
                     source.status === 'error' ? 'Error' :
                     source.status === 'transcribing' ? 'Transcribing...' :
                     source.status === 'fetching-metadata' ? 'Loading...' : 
                     'Pending'}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add YouTube Video</DialogTitle>
            <DialogDescription>
              Paste a YouTube URL to extract quotes from the video transcript
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="youtube-url">YouTube URL</Label>
              <Input
                id="youtube-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isLoading) {
                    handleAddSource();
                  }
                }}
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setUrl("");
                  setIsDialogOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleAddSource} disabled={isLoading}>
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Add Video
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}