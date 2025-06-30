"use client";

import React from "react";
import { Source } from "@/lib/types";
import { SourceCard } from "./SourceCard";
import { cn } from "@/lib/utils";

interface SourceGridProps {
  sources: Source[];
  viewMode?: 'grid' | 'list';
  onSourceSelect?: (source: Source) => void;
  onQuoteAdd?: (sourceId: string) => void;
  onSourceEdit?: (source: Source) => void;
  onSourceDelete?: (sourceId: string) => void;
  className?: string;
}

export function SourceGrid({
  sources,
  viewMode = 'grid',
  onSourceSelect,
  onQuoteAdd,
  onSourceEdit,
  onSourceDelete,
  className
}: SourceGridProps) {
  if (viewMode === 'list') {
    return (
      <div className={cn("space-y-2", className)}>
        {sources.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            viewMode="list"
            onSelect={onSourceSelect}
            onQuoteAdd={onQuoteAdd}
            onEdit={onSourceEdit}
            onDelete={onSourceDelete}
          />
        ))}
      </div>
    );
  }

  return (
    <div 
      className={cn(
        "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {sources.map((source) => (
        <SourceCard
          key={source.id}
          source={source}
          viewMode="grid"
          onSelect={onSourceSelect}
          onQuoteAdd={onQuoteAdd}
          onEdit={onSourceEdit}
          onDelete={onSourceDelete}
        />
      ))}
    </div>
  );
}