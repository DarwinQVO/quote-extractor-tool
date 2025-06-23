import { useState } from 'react';
import { useStore } from '@/lib/store';
import { Quote, VideoSource } from '@/lib/types';
import { toast } from './use-toast';

interface ExportResult {
  url: string;
  documentId: string;
  title: string;
  quotesCount: number;
}

export function useGoogleDocsExport() {
  const [isExporting, setIsExporting] = useState(false);
  const { markQuotesAsExported } = useStore();
  
  const exportToGoogleDocs = async (
    quotes: Quote[],
    source: VideoSource
  ): Promise<ExportResult | null> => {
    if (quotes.length === 0) {
      toast({
        title: 'No quotes to export',
        description: 'Add some quotes before exporting',
        variant: 'destructive',
      });
      return null;
    }
    
    setIsExporting(true);
    
    // Show progress toast
    const progressToast = toast({
      title: 'Exporting to Google Docs...',
      description: `Preparing ${quotes.length} quote${quotes.length > 1 ? 's' : ''} for export`,
      duration: Infinity, // Keep until we update it
    });
    
    try {
      const response = await fetch('/api/export/doc', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceId: source.id,
          quotes,
          source,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Export failed');
      }
      
      const result: ExportResult = await response.json();
      
      // Mark quotes as exported
      const quoteIds = quotes.map(q => q.id);
      markQuotesAsExported(quoteIds);
      
      // Show success toast with link
      toast({
        title: 'Export successful!',
        description: `Document "${result.title}" created with ${result.quotesCount} quotes. Click to open.`,
        action: (
          <button
            onClick={() => window.open(result.url, '_blank')}
            className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
          >
            Open Doc ↗
          </button>
        ),
        duration: 10000,
      });
      
      return result;
      
    } catch (error) {
      console.error('Export error:', error);
      
      toast({
        title: 'Export failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      
      return null;
    } finally {
      setIsExporting(false);
      // Dismiss progress toast
      progressToast.dismiss?.();
    }
  };
  
  return {
    exportToGoogleDocs,
    isExporting,
  };
}