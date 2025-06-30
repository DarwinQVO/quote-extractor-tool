"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  MoreVertical, 
  ExternalLink,
  Edit,
  Trash2,
  Tag,
  Clock,
  Youtube,
  Globe,
  FileText
} from "lucide-react";
import { Quote } from "@/lib/types";
import { formatRelativeDate } from "@/lib/utils";
import { useSourceStore } from "@/store/useSourceStore";

interface QuoteCardProps {
  quote: Quote;
  onSelect?: (quote: Quote) => void;
  onEdit?: (quote: Quote) => void;
  onDelete?: (quoteId: string) => void;
  className?: string;
}

export function QuoteCard({
  quote,
  onSelect,
  onEdit,
  onDelete,
  className
}: QuoteCardProps) {
  const { getSourceById } = useSourceStore();
  const source = getSourceById(quote.source_id);

  const getSourceIcon = () => {
    if (!source) return <FileText className="h-4 w-4 text-gray-500" />;
    
    switch (source.type) {
      case 'youtube':
        return <Youtube className="h-4 w-4 text-red-500" />;
      case 'web':
        return <Globe className="h-4 w-4 text-blue-500" />;
      case 'document':
        return <FileText className="h-4 w-4 text-green-600" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Card 
      className={cn(
        "group cursor-pointer hover:shadow-md transition-all",
        className
      )}
      onClick={() => onSelect?.(quote)}
    >
      <CardContent className="p-4">
        {/* Quote Text */}
        <blockquote className="text-sm leading-relaxed mb-3 border-l-4 border-primary pl-4 italic">
          "{quote.text}"
        </blockquote>

        {/* Metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Source info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              {getSourceIcon()}
              <span className="truncate">
                {source?.title || 'Unknown Source'}
              </span>
              {quote.timestamp && (
                <>
                  <span>•</span>
                  <span>{quote.timestamp}</span>
                </>
              )}
            </div>

            {/* Tags and date */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {quote.tags.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Tag className="h-3 w-3 text-muted-foreground" />
                    <div className="flex gap-1">
                      {quote.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs rounded bg-secondary text-secondary-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                      {quote.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{quote.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeDate(quote.created_at)}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {source && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(source.url, '_blank');
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            )}
            
            {onEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(quote);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            
            {onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(quote.id);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}