/**
 * Enterprise-level text formatting utilities
 * Handles proper curly quotes, citations, and multi-format output
 */

import { Quote, VideoSource } from './types';

// Unicode curly quotes
export const CURLY_QUOTES = {
  LEFT: '\u201C',   // U+201C - Left double quotation mark
  RIGHT: '\u201D',  // U+201D - Right double quotation mark
} as const;

/**
 * Formats quote text with proper curly quotes
 */
export function formatQuoteText(text: string): string {
  return `${CURLY_QUOTES.LEFT}${text}${CURLY_QUOTES.RIGHT}`;
}

/**
 * Formats a complete quote with text and citation
 */
export function formatQuoteWithCitation(
  text: string, 
  citation: string,
  separator: string = ' '
): string {
  return `${formatQuoteText(text)}${separator}${citation}`;
}

/**
 * Formats quote for clipboard (plain text)
 */
export function formatQuoteForClipboard(quote: Quote): string {
  return formatQuoteWithCitation(quote.text, quote.citation);
}

/**
 * Formats quote for HTML clipboard
 */
export function formatQuoteForHtml(quote: Quote): string {
  const formattedText = formatQuoteText(quote.text);
  return `${formattedText} <a href="${quote.timestampLink}">${quote.citation}</a>`;
}

/**
 * Formats multiple quotes for bulk copying
 */
export function formatMultipleQuotes(
  quotes: Quote[], 
  sources: VideoSource[],
  format: 'plain' | 'html' = 'plain'
): string {
  const formattedQuotes = quotes
    .map(quote => {
      const source = sources.find(s => s.id === quote.sourceId);
      if (!source) return '';
      
      if (format === 'html') {
        return formatQuoteForHtml(quote);
      }
      return formatQuoteForClipboard(quote);
    })
    .filter(Boolean);
  
  return format === 'html' 
    ? formattedQuotes.join('<br><br>')
    : formattedQuotes.join('\n\n');
}

/**
 * Formats quote for Google Docs export
 */
export function formatQuoteForGoogleDocs(quote: Quote): string {
  return formatQuoteWithCitation(quote.text, quote.citation);
}

/**
 * Formats quote for markdown export
 */
export function formatQuoteForMarkdown(quote: Quote): string {
  const formattedText = formatQuoteText(quote.text);
  return `> ${formattedText}  \n[${quote.citation}](${quote.timestampLink})`;
}

/**
 * Formats citation text with proper formatting
 */
export function formatCitation(
  speaker: string,
  date: string,
  time?: string
): string {
  if (time) {
    return `${speaker}, (${time} / ${date})`;
  }
  return `${speaker} (${date})`;
}

/**
 * Formats time for display
 */
export function formatTimeForDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats date for citation
 */
export function formatDateForCitation(date: Date): string {
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${month} ${year}`;
}

/**
 * Formats date for Google Docs export
 */
export function formatDateForGoogleDocs(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
}