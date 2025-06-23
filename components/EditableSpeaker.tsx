"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface EditableSpeakerProps {
  speaker: string;
  onSpeakerUpdate: (newSpeaker: string) => void;
}

export function EditableSpeaker({ speaker, onSpeakerUpdate }: EditableSpeakerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(speaker);
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!editValue.trim()) {
      toast({
        title: "Error",
        description: "Speaker name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (editValue.trim() === speaker) {
      setIsEditing(false);
      return;
    }

    setIsLoading(true);
    try {
      // Update the speaker name for this quote
      onSpeakerUpdate(editValue.trim());
      setIsEditing(false);
      
      toast({
        title: "Speaker updated",
        description: "Speaker name has been updated for this quote",
      });
    } catch (error) {
      console.error('Error updating speaker:', error);
      toast({
        title: "Update failed",
        description: "Failed to update speaker name",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setEditValue(speaker);
    setIsEditing(false);
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

  if (isEditing) {
    return (
      <Input
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSave}
        disabled={isLoading}
        className="h-6 px-2 py-0 text-xs border-primary focus:ring-1 focus:ring-primary"
        style={{ width: `${Math.max(editValue.length * 8, 60)}px` }}
        autoFocus
      />
    );
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className="hover:bg-muted/50 hover:text-foreground px-1 py-0.5 rounded transition-colors cursor-pointer"
      title="Click to edit speaker name"
    >
      {speaker}
    </button>
  );
}