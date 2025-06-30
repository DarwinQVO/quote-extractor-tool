"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  MoreVertical, 
  Clock, 
  User, 
  Eye,
  Quote,
  ExternalLink,
  FileText,
  Youtube,
  Globe,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { 
  Source, 
  isYouTubeSource, 
  isWebSource, 
  isDocumentSource 
} from "@/lib/types";
import { 
  formatDuration, 
  formatRelativeDate, 
  extractDomain, 
  formatFileSize 
} from "@/lib/utils";

interface SourceCardProps {
  source: Source;
  viewMode?: 'grid' | 'list';
  onSelect?: (source: Source) => void;
  onQuoteAdd?: (sourceId: string) => void;
  onEdit?: (source: Source) => void;
  onDelete?: (sourceId: string) => void;
  className?: string;
}

export function SourceCard({ 
  source, 
  viewMode = 'grid',
  onSelect,
  onQuoteAdd,
  onEdit,
  onDelete,
  className 
}: SourceCardProps) {
  const getSourceIcon = () => {
    switch (source.type) {
      case 'youtube':
        return <Youtube className="h-5 w-5 text-red-500" />;
      case 'web':
        return <Globe className="h-5 w-5 text-blue-500" />;
      case 'document':
        return <FileText className="h-5 w-5 text-green-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusIcon = () => {
    switch (source.status) {
      case 'ready':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSourceMetadata = () => {
    if (isYouTubeSource(source)) {
      return {
        primary: source.metadata.channel,
        secondary: formatDuration(source.metadata.duration),
        thumbnail: source.metadata.thumbnail
      };
    } else if (isWebSource(source)) {
      return {
        primary: source.metadata.provider || extractDomain(source.url),
        secondary: source.metadata.reading_time 
          ? `${source.metadata.reading_time} min read` 
          : null,
        thumbnail: source.metadata.image
      };
    } else if (isDocumentSource(source)) {
      return {
        primary: formatFileSize(source.metadata.file_size),
        secondary: source.metadata.page_count 
          ? `${source.metadata.page_count} pages` 
          : null,
        thumbnail: null
      };
    }
    return { primary: null, secondary: null, thumbnail: null };
  };

  const metadata = getSourceMetadata();

  if (viewMode === 'list') {
    return (
      <div 
        className={cn(
          "group flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer",
          className
        )}
        onClick={() => onSelect?.(source)}
      >
        {/* Thumbnail or Icon */}
        <div className="flex-shrink-0">
          {metadata.thumbnail ? (
            <img 
              src={metadata.thumbnail} 
              alt={source.title}
              className="w-20 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-20 h-12 bg-muted rounded flex items-center justify-center">
              {getSourceIcon()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate flex items-center gap-2">
                {source.title}
                {getStatusIcon()}
              </h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                {metadata.primary && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {metadata.primary}
                  </span>
                )}
                {metadata.secondary && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {metadata.secondary}
                  </span>
                )}
                <span>{formatRelativeDate(source.created_at)}</span>
              </div>
              {source.categories.length > 0 && (
                <div className="flex items-center gap-1 mt-2">
                  {source.categories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
                    >
                      {cat}
                    </span>
                  ))}
                  {source.categories.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{source.categories.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(source.url, '_blank');
                }}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onQuoteAdd?.(source.id);
                }}
              >
                <Quote className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implement dropdown menu
                }}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div 
      className={cn(
        "group relative rounded-lg border bg-card overflow-hidden hover:shadow-lg transition-all cursor-pointer",
        className
      )}
      onClick={() => onSelect?.(source)}
    >
      {/* Thumbnail */}
      {metadata.thumbnail ? (
        <div className="aspect-video relative overflow-hidden bg-muted">
          <img 
            src={metadata.thumbnail} 
            alt={source.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2">
            {getSourceIcon()}
          </div>
          <div className="absolute top-2 right-2">
            {getStatusIcon()}
          </div>
          {isYouTubeSource(source) && (
            <div className="absolute bottom-2 right-2 px-2 py-1 text-xs font-medium bg-black/80 text-white rounded">
              {formatDuration(source.metadata.duration)}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-video relative bg-muted flex items-center justify-center">
          <div className="text-center">
            {getSourceIcon()}
            <p className="text-xs text-muted-foreground mt-2">{source.type}</p>
          </div>
          <div className="absolute top-2 right-2">
            {getStatusIcon()}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <h3 className="font-medium line-clamp-2 mb-2">{source.title}</h3>
        
        {/* Metadata */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3">
          {metadata.primary && (
            <span className="flex items-center gap-1 truncate">
              <User className="h-3 w-3 flex-shrink-0" />
              {metadata.primary}
            </span>
          )}
          {metadata.secondary && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {metadata.secondary}
            </span>
          )}
        </div>

        {/* Categories */}
        {source.categories.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {source.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary"
              >
                {cat}
              </span>
            ))}
            {source.categories.length > 2 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                +{source.categories.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatRelativeDate(source.created_at)}
          </span>
          
          {/* Hover Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onQuoteAdd?.(source.id);
              }}
            >
              <Quote className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}