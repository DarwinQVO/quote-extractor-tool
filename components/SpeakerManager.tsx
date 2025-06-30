"use client";

import { useState, useEffect } from "react";
import { Users, Edit3, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useStore } from "@/lib/store";
import { Transcript } from "@/lib/types";
import { speakerColorManager, useSpeakerColors } from "@/lib/speaker-colors";

interface SpeakerManagerProps {
  sourceId: string | null;
}

interface SpeakerInfo {
  originalName: string;
  customName: string;
  count: number;
}

export function SpeakerManager({ sourceId }: SpeakerManagerProps) {
  const { transcripts, updateTranscript, quotes, updateMultipleQuotes, syncToDatabase } = useStore();
  const [speakers, setSpeakers] = useState<SpeakerInfo[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const transcript = sourceId ? transcripts.get(sourceId) : null;

  useEffect(() => {
    if (transcript?.segments && transcript.segments.length > 0) {
      // Count occurrences of each speaker
      const speakerCounts: Record<string, number> = {};
      transcript.segments.forEach(segment => {
        if (segment.speaker) {
          speakerCounts[segment.speaker] = (speakerCounts[segment.speaker] || 0) + 1;
        }
      });

      // Create speaker info array
      const speakerInfoArray: SpeakerInfo[] = Object.entries(speakerCounts)
        .map(([name, count]) => ({
          originalName: name,
          customName: name,
          count
        }))
        .sort((a, b) => b.count - a.count); // Sort by frequency

      setSpeakers(speakerInfoArray);
    } else {
      setSpeakers([]);
    }
  }, [transcript, sourceId]);

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setEditValue(speakers[index].customName);
  };

  const handleSave = async () => {
    if (editingIndex === null || !editValue.trim()) {
      setEditingIndex(null);
      setEditValue("");
      return;
    }

    const speaker = speakers[editingIndex];
    if (editValue.trim() === speaker.customName) {
      setEditingIndex(null);
      setEditValue("");
      return;
    }

    setIsSaving(true);
    const newName = editValue.trim();
    const oldName = speaker.customName;

    try {
      // Update transcript segments
      if (transcript) {
        const updatedSegments = transcript.segments.map(segment => ({
          ...segment,
          speaker: segment.speaker === oldName ? newName : segment.speaker
        }));

        // Update transcript in store
        updateTranscript(sourceId!, {
          ...transcript,
          segments: updatedSegments,
          speakers: transcript.speakers?.map(s => 
            typeof s === 'object' && 'customName' in s && s.customName === oldName 
              ? { ...s, customName: newName }
              : s
          )
        });

        // Update speaker color mapping
        speakerColorManager.updateSpeakerName(oldName, newName);

        // Update quotes
        const quotesToUpdate = quotes.filter(
          quote => quote.sourceId === sourceId && quote.speaker === oldName
        );

        if (quotesToUpdate.length > 0) {
          const updates = quotesToUpdate.map(quote => ({
            id: quote.id,
            updates: {
              speaker: newName,
              citation: quote.citation.replace(oldName, newName)
            }
          }));
          
          updateMultipleQuotes(updates);
        }

        // Sync to database
        await syncToDatabase();

        // Update local state
        const newSpeakers = [...speakers];
        newSpeakers[editingIndex] = { ...speaker, customName: newName };
        setSpeakers(newSpeakers);

        toast({
          title: "Speaker updated",
          description: `"${oldName}" has been renamed to "${newName}"`,
        });
      }
    } catch (error) {
      console.error('Failed to update speaker:', error);
      toast({
        title: "Update failed",
        description: "Failed to save speaker changes. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
      setEditingIndex(null);
      setEditValue("");
    }
  };

  const handleCancel = () => {
    setEditingIndex(null);
    setEditValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className="w-full">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Manage Speakers</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Click on any speaker name to rename it. Changes are saved automatically.
        </p>
      </div>
      
      <div className="p-6">
        {!transcript ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No transcript available. Please select a video with a completed transcript.
            </p>
          </div>
        ) : speakers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No speakers found in this transcript.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {speakers.map((speaker, index) => {
              const speakerColors = useSpeakerColors(speaker.customName);
              
              return (
                <div
                  key={`${speaker.originalName}-${index}`}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${speakerColors.background} hover:shadow-sm`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    {/* Speaker color indicator */}
                    <div className={`w-4 h-4 rounded-full ${speakerColors.accent.replace('text-', 'bg-')} flex-shrink-0`}></div>
                  {editingIndex === index ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-9 flex-1"
                        autoFocus
                        disabled={isSaving}
                        placeholder="Speaker name"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0"
                        onClick={handleSave}
                        disabled={isSaving}
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-9 w-9 p-0"
                        onClick={handleCancel}
                        disabled={isSaving}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEdit(index)}
                        className={`flex items-center gap-2 transition-colors group flex-1 text-left p-2 rounded hover:opacity-80`}
                      >
                        <span className={`font-semibold text-base ${speakerColors.text}`}>
                          {speaker.customName}
                        </span>
                        <Edit3 className={`w-4 h-4 opacity-0 group-hover:opacity-60 transition-opacity ${speakerColors.accent}`} />
                      </button>
                      <div className="text-right">
                        <span className={`text-sm font-medium ${speakerColors.accent}`}>
                          {speaker.count}
                        </span>
                        <p className={`text-xs ${speakerColors.text} opacity-70`}>
                          segment{speaker.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
        
        {speakers.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Changes are automatically saved to the database</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}