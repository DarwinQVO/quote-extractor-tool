"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit2, Check, X, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Speaker {
  id: string;
  originalName: string;
  customName: string;
}

interface SpeakerEditorProps {
  sourceId: string;
  onSpeakerUpdate?: (speakers: Speaker[]) => void;
}

export function SpeakerEditor({ sourceId, onSpeakerUpdate }: SpeakerEditorProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchSpeakers = useCallback(async () => {
    try {
      const response = await fetch(`/api/speakers/by-source/${sourceId}`);
      if (response.ok) {
        const data = await response.json();
        setSpeakers(data.speakers || []);
      }
    } catch (error) {
      console.error('Error fetching speakers:', error);
    }
  }, [sourceId]);

  useEffect(() => {
    fetchSpeakers();
  }, [fetchSpeakers]);

  const startEditing = (speaker: Speaker) => {
    setEditingId(speaker.id);
    setEditValue(speaker.customName);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveSpeaker = async (speakerId: string) => {
    if (!editValue.trim()) {
      toast({
        title: "Error",
        description: "Speaker name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/speakers/by-source/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speakerId,
          customName: editValue.trim(),
        }),
      });

      if (response.ok) {
        await response.json();
        setSpeakers(prev => prev.map(s => 
          s.id === speakerId 
            ? { ...s, customName: editValue.trim() }
            : s
        ));
        
        setEditingId(null);
        setEditValue("");
        
        toast({
          title: "Success",
          description: "Speaker name updated successfully",
        });
        
        // Notify parent component
        if (onSpeakerUpdate) {
          const updatedSpeakers = speakers.map(s => 
            s.id === speakerId 
              ? { ...s, customName: editValue.trim() }
              : s
          );
          onSpeakerUpdate(updatedSpeakers);
        }
      } else {
        throw new Error('Failed to update speaker');
      }
    } catch (error) {
      console.error('Error updating speaker:', error);
      toast({
        title: "Error",
        description: "Failed to update speaker name",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (speakers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Speakers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No speakers detected yet. Transcribe a video to see speaker identification.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-4 h-4" />
          Speakers ({speakers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {speakers.map((speaker) => (
          <div key={speaker.id} className="flex items-center gap-2 p-2 rounded-lg border">
            {editingId === speaker.id ? (
              <>
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveSpeaker(speaker.id);
                    if (e.key === 'Escape') cancelEditing();
                  }}
                  className="flex-1"
                  placeholder="Speaker name"
                  disabled={loading}
                />
                <Button
                  size="sm"
                  onClick={() => saveSpeaker(speaker.id)}
                  disabled={loading}
                >
                  <Check className="w-3 h-3" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelEditing}
                  disabled={loading}
                >
                  <X className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <>
                <div className="flex-1">
                  <div className="font-medium">{speaker.customName}</div>
                  {speaker.originalName !== speaker.customName && (
                    <div className="text-xs text-muted-foreground">
                      Originally: {speaker.originalName}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => startEditing(speaker)}
                >
                  <Edit2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}