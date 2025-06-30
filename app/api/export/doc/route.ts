import { NextRequest, NextResponse } from 'next/server';
import { getDocsClient, getDriveClient } from '@/lib/google-auth';
import { Quote, VideoSource } from '@/lib/types';
import { formatQuoteForGoogleDocs, formatTimeForDisplay, formatDateForGoogleDocs } from '@/lib/text-formatter';

interface ExportRequest {
  sourceId: string;
  quotes: Quote[];
  source: VideoSource;
}

export async function POST(request: NextRequest) {
  try {
    const { sourceId, quotes, source }: ExportRequest = await request.json();
    
    if (!sourceId || !quotes || quotes.length === 0) {
      return NextResponse.json(
        { error: 'sourceId and quotes are required' },
        { status: 400 }
      );
    }
    
    if (!source) {
      return NextResponse.json(
        { error: 'source information is required' },
        { status: 400 }
      );
    }
    
    const docs = await getDocsClient();
    const drive = await getDriveClient();
    
    // Create document title
    const docTitle = `${source.title} – Quotes`;
    
    // Create new document
    const createResponse = await docs.documents.create({
      requestBody: {
        title: docTitle,
      },
    });
    
    const documentId = createResponse.data.documentId;
    if (!documentId) {
      throw new Error('Failed to create document');
    }
    
    // Build content requests for batch update
    const requests = [];
    let insertIndex = 1; // Start after title
    
    // Add header
    requests.push({
      insertText: {
        location: { index: insertIndex },
        text: `Quotes from: ${source.title}\nChannel: ${source.channel}\nExtracted: ${new Date().toLocaleDateString()}\n\n`,
      },
    });
    
    // Calculate header length for next insertions
    const headerText = `Quotes from: ${source.title}\nChannel: ${source.channel}\nExtracted: ${new Date().toLocaleDateString()}\n\n`;
    insertIndex += headerText.length;
    
    // Add each quote
    for (let i = 0; i < quotes.length; i++) {
      const quote = quotes[i];
      const timeFormatted = formatTimeForDisplay(quote.startTime);
      const dateFormatted = formatDateForGoogleDocs(source.addedAt);
      
      // Quote text with citation using proper curly quotes
      const formattedQuoteText = formatQuoteForGoogleDocs(quote);
      const quoteText = `${formattedQuoteText}\n— ${quote.speaker}, (${timeFormatted} / ${dateFormatted})\n\n`;
      
      // Insert quote text
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: quoteText,
        },
      });
      
      // Style the quote (italic) - adjust for curly quotes
      const quoteStartIndex = insertIndex + 1; // Skip opening curly quote
      const quoteEndIndex = insertIndex + quote.text.length + 1;
      
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: quoteStartIndex,
            endIndex: quoteEndIndex,
          },
          textStyle: {
            italic: true,
          },
          fields: 'italic',
        },
      });
      
      // Add link to citation
      const citationStart = insertIndex + quoteText.indexOf('— ');
      const citationEnd = insertIndex + quoteText.length - 2; // Before \n\n
      
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: citationStart,
            endIndex: citationEnd,
          },
          textStyle: {
            link: {
              url: quote.timestampLink,
            },
          },
          fields: 'link',
        },
      });
      
      insertIndex += quoteText.length;
    }
    
    // Apply all formatting
    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests,
        },
      });
    }
    
    // Make document publicly viewable (optional, for easier sharing)
    try {
      await drive.permissions.create({
        fileId: documentId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (error) {
      // Non-critical error, continue without public sharing
      console.warn('Failed to make document public:', error);
    }
    
    // Return document URL
    const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
    
    return NextResponse.json({
      url: documentUrl,
      documentId,
      title: docTitle,
      quotesCount: quotes.length,
    });
    
  } catch (error) {
    console.error('Google Docs export error:', error);
    
    let errorMessage = 'Failed to export to Google Docs';
    if (error instanceof Error) {
      if (error.message.includes('GOOGLE_SERVICE_ACCOUNT_JSON')) {
        errorMessage = 'Google service account not configured';
      } else if (error.message.includes('credentials')) {
        errorMessage = 'Invalid Google credentials';
      } else if (error.message.includes('quota')) {
        errorMessage = 'Google API quota exceeded';
      }
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
      },
      { status: 500 }
    );
  }
}