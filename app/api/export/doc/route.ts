import { NextRequest, NextResponse } from 'next/server';
import { getDocsClient, getDriveClient } from '@/lib/google-auth';
import { Quote, VideoSource } from '@/lib/types';
import { formatTimeForDisplay } from '@/lib/citations';

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
      const dateFormatted = source.addedAt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
      
      // Quote text with citation
      const quoteText = `"${quote.text}"\n— ${quote.speaker}, (${timeFormatted} / ${dateFormatted})\n\n`;
      
      // Insert quote text
      requests.push({
        insertText: {
          location: { index: insertIndex },
          text: quoteText,
        },
      });
      
      // Style the quote (italic)
      requests.push({
        updateTextStyle: {
          range: {
            startIndex: insertIndex + 1, // Skip opening quote
            endIndex: insertIndex + quote.text.length + 1,
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