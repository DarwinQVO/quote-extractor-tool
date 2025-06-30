"use client";

import { Copy, FileText, Trash2, Upload, CheckCircle, Filter, Globe } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useGoogleDocsExport } from "@/hooks/useGoogleDocsExport";
import { formatQuoteForClipboard, formatQuoteForHtml, formatMultipleQuotes, formatQuoteText } from "@/lib/text-formatter";
import { useState } from "react";

export function QuotesPanel() {
  const { quotes, removeQuote, sources, activeSourceId } = useStore();
  const { exportToGoogleDocs, isExporting } = useGoogleDocsExport();
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  
  const activeSource = sources.find(s => s.id === activeSourceId);
  
  // Filter quotes based on current selection
  const filteredQuotes = showAllQuotes 
    ? quotes 
    : quotes.filter(quote => quote.sourceId === activeSourceId);
  
  const handleCopyAll = async () => {
    if (filteredQuotes.length === 0) {
      toast({
        title: "No quotes to copy",
        description: "Add some quotes first",
        variant: "destructive",
      });
      return;
    }
    
    const plainTextQuotes = formatMultipleQuotes(filteredQuotes, sources, 'plain');
    const htmlQuotes = formatMultipleQuotes(filteredQuotes, sources, 'html');
    
    try {
      // Use modern clipboard API to write multiple formats
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainTextQuotes], { type: 'text/plain' }),
          'text/html': new Blob([htmlQuotes], { type: 'text/html' }),
        }),
      ]);
      
      toast({
        title: "Copied to clipboard",
        description: `${filteredQuotes.length} quote${filteredQuotes.length > 1 ? 's' : ''} copied with clickable links`,
      });
    } catch {
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(plainTextQuotes);
        toast({
          title: "Copied to clipboard",
          description: `${filteredQuotes.length} quote${filteredQuotes.length > 1 ? 's' : ''} copied as plain text`,
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Unable to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleCopyQuote = async (quote: { sourceId: string; text: string; citation: string; timestampLink: string }) => {
    const source = sources.find(s => s.id === quote.sourceId);  
    if (!source) return;
    
    // Create rich text format for Google Docs using unified formatter
    const plainText = formatQuoteForClipboard(quote as any);
    const htmlFormat = formatQuoteForHtml(quote as any);
    
    try {
      // Use modern clipboard API to write multiple formats
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
          'text/html': new Blob([htmlFormat], { type: 'text/html' }),
        }),
      ]);
      
      toast({
        title: "Quote copied",
        description: "Quote copied with clickable link for Google Docs",
      });
    } catch {
      // Fallback to plain text
      try {
        await navigator.clipboard.writeText(plainText);
        toast({
          title: "Quote copied",
          description: "Quote copied as plain text",
        });
      } catch {
        toast({
          title: "Copy failed",
          description: "Unable to copy to clipboard",
          variant: "destructive",
        });
      }
    }
  };
  
  const handleDeleteAll = () => {
    if (filteredQuotes.length === 0) return;
    
    filteredQuotes.forEach(quote => removeQuote(quote.id));
    
    toast({
      title: "All quotes deleted",
      description: "Your quote collection has been cleared",
    });
  };
  
  const handleGoogleDocsExport = async () => {
    if (!activeSource) {
      toast({
        title: "No active source",
        description: "Please select a video source first",
        variant: "destructive",
      });
      return;
    }
    
    // Filter quotes for active source
    const sourceQuotes = quotes.filter(q => q.sourceId === activeSourceId);
    
    if (sourceQuotes.length === 0) {
      toast({
        title: "No quotes from this source",
        description: "Add some quotes from the current video first",
        variant: "destructive",
      });
      return;
    }
    
    await exportToGoogleDocs(sourceQuotes, activeSource);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Quotes</h2>
            <p className="text-sm text-muted-foreground">
              {showAllQuotes ? (
                <>
                  {quotes.length} quote{quotes.length !== 1 ? 's' : ''} from all videos
                  {activeSource && quotes.filter(q => q.sourceId === activeSourceId).length > 0 && (
                    <span className="ml-2 text-muted-foreground/70">
                      ({quotes.filter(q => q.sourceId === activeSourceId).length} from current video)
                    </span>
                  )}
                </>
              ) : (
                <>
                  {filteredQuotes.length} quote{filteredQuotes.length !== 1 ? 's' : ''} from current video
                  {quotes.length > filteredQuotes.length && (
                    <span className="ml-2 text-muted-foreground/70">
                      ({quotes.length} total)
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleCopyAll}
              disabled={filteredQuotes.length === 0}
              title="Copy all quotes"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleGoogleDocsExport}
              disabled={
                quotes.filter(q => q.sourceId === activeSourceId).length === 0 || 
                isExporting ||
                !activeSource
              }
              title="Export to Google Docs"
            >
              {isExporting ? (
                <Upload className="w-4 h-4 animate-pulse" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </Button>
            <Button 
              variant="ghost"
              size="sm"
              onClick={handleDeleteAll}
              disabled={filteredQuotes.length === 0}
              title="Delete all quotes"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Filter toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={showAllQuotes ? "ghost" : "default"}
            size="sm"
            onClick={() => setShowAllQuotes(false)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Current Video
            {!showAllQuotes && filteredQuotes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                {filteredQuotes.length}
              </span>
            )}
          </Button>
          <Button
            variant={showAllQuotes ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowAllQuotes(true)}
            className="flex items-center gap-2"
          >
            <Globe className="w-4 h-4" />
            All Videos
            {showAllQuotes && quotes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                {quotes.length}
              </span>
            )}
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredQuotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {showAllQuotes 
              ? "No quotes collected yet. Select text from the transcript to add quotes."
              : activeSource 
                ? "No quotes from this video yet. Select text from the transcript to add quotes."
                : "Select a video to view its quotes."
            }
          </p>
        ) : (
          filteredQuotes.map((quote) => {     
            const quoteSource = sources.find(s => s.id === quote.sourceId);       
            return (
              <Card key={quote.id} className={`group ${quote.exported ? 'ring-2 ring-green-500/20 bg-green-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Show video title when viewing all quotes */}
                    {showAllQuotes && quoteSource && (
                      <div className="text-xs text-muted-foreground border-b border-border pb-2 mb-3">
                        <span className="font-medium">From:</span> {quoteSource.title}
                      </div>
                    )}
                    
                    <blockquote className="text-sm leading-relaxed italic border-l-4 border-primary pl-4">
                      {formatQuoteText(quote.text)} 
                      <span className="text-xs text-muted-foreground not-italic">
                        <a 
                          href={quote.timestampLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline transition-colors"
                        >
                          {quote.citation}
                        </a>
                      </span>
                    </blockquote>
                    
                    {/* Action buttons */}
                    <div className="flex items-center justify-end">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyQuote(quote)}
                          title="Copy quote"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeQuote(quote.id)}
                          title="Delete quote"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        {quote.exported && (
                          <div title="Exported to Google Docs">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}