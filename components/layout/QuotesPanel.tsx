"use client";

import { Copy, FileText, Trash2 } from "lucide-react";

export function QuotesPanel() {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quotes</h2>
        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Copy all quotes">
            <Copy className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Export to Google Docs">
            <FileText className="w-4 h-4" />
          </button>
          <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Delete all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        <p className="text-sm text-muted-foreground text-center py-8">
          No quotes collected yet. Select text from the transcript to add quotes.
        </p>
      </div>
    </div>
  );
}