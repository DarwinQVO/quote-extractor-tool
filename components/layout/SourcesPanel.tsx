"use client";

import { Plus } from "lucide-react";

export function SourcesPanel() {
  return (
    <div className="h-full flex flex-col bg-muted/30 border-r border-border">
      <div className="p-6 border-b border-border">
        <h2 className="text-lg font-semibold mb-4">Sources</h2>
        <button className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors duration-200 font-medium shadow-sm">
          <Plus className="w-4 h-4" />
          Add YouTube URL
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-sm text-muted-foreground text-center py-8">
          No sources added yet. Add a YouTube URL to get started.
        </p>
      </div>
    </div>
  );
}