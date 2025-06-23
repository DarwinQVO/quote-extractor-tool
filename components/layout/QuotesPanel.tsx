"use client";

import { Copy, FileText, Trash2, ExternalLink, Clock, Upload, CheckCircle } from "lucide-react";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { buildCitation, formatTimeForDisplay } from "@/lib/citations";
import { useGoogleDocsExport } from "@/hooks/useGoogleDocsExport";

export function QuotesPanel() {
  const { quotes, removeQuote, sources, activeSourceId } = useStore();
  const { exportToGoogleDocs, isExporting } = useGoogleDocsExport();
  
  const activeSource = sources.find(s => s.id === activeSourceId);
  
  const handleCopyAll = async () => {
    if (quotes.length === 0) {
      toast({
        title: "No quotes to copy",
        description: "Add some quotes first",
        variant: "destructive",
      });
      return;
    }
    
    const markdownText = quotes
      .map(quote => {
        const source = sources.find(s => s.id === quote.sourceId);
        if (!source) return '';
        
        return `> "${quote.text}"  \n— [${quote.citation}](${quote.timestampLink})`;
      })
      .filter(Boolean)
      .join('\n\n');
    
    try {
      await navigator.clipboard.writeText(markdownText);
      toast({
        title: "Copied to clipboard",
        description: `${quotes.length} quote${quotes.length > 1 ? 's' : ''} copied as Markdown`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  const handleCopyQuote = async (quote: any) => {
    const source = sources.find(s => s.id === quote.sourceId);
    if (!source) return;
    
    const markdown = `> "${quote.text}"  \n— [${quote.citation}](${quote.timestampLink})`;
    
    try {
      await navigator.clipboard.writeText(markdown);
      toast({
        title: "Quote copied",
        description: "Quote copied as Markdown",
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };
  
  const handleDeleteAll = () => {
    if (quotes.length === 0) return;
    
    quotes.forEach(quote => removeQuote(quote.id));
    
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
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quotes</h2>
          <p className="text-sm text-muted-foreground">
            {quotes.length} quote{quotes.length !== 1 ? 's' : ''} collected
            {activeSource && quotes.filter(q => q.sourceId === activeSourceId).length > 0 && (
              <span className="ml-2">
                ({quotes.filter(q => q.sourceId === activeSourceId).length} from current video)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost"
            size="sm"
            onClick={handleCopyAll}
            disabled={quotes.length === 0}
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
            disabled={quotes.length === 0}
            title="Delete all quotes"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {quotes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No quotes collected yet. Select text from the transcript to add quotes.
          </p>
        ) : (
          quotes.map((quote) => {
            const source = sources.find(s => s.id === quote.sourceId);
            
            return (
              <Card key={quote.id} className={`group ${quote.exported ? 'ring-2 ring-green-500/20 bg-green-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <blockquote className="text-sm leading-relaxed italic border-l-4 border-primary pl-4">
                      "{quote.text}"
                    </blockquote>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <span>{quote.speaker}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeForDisplay(quote.startTime)}
                        </span>
                        {quote.exported && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-3 h-3" />
                            Exported
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleCopyQuote(quote)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => window.open(quote.timestampLink, '_blank')}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeQuote(quote.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {source && (
                      <div className="text-xs text-muted-foreground truncate">
                        From: {source.title}
                      </div>
                    )}
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