import { VideoSource, Segment } from './types';
import { formatQuoteText } from './text-formatter';

export function buildCitation(
  source: VideoSource,
  segment: Segment | { speaker: string; start: number; end: number; text: string },
  videoDate?: Date,
  preciseStartTime?: number
): {
  text: string;
  link: string;
  markdown: string;
} {
  // Extract video ID from URL
  const videoIdMatch = source.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  const videoId = videoIdMatch?.[1] || '';
  
  // Use precise start time if provided, otherwise use segment start
  const startTime = preciseStartTime !== undefined ? preciseStartTime : segment.start;
  const timestampSeconds = Math.floor(startTime);
  const link = `https://youtu.be/${videoId}?t=${timestampSeconds}`;
  
  // Format date (MMM YYYY format - 3 letter month)
  const date = videoDate || source.addedAt;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  
  // Build citation text with embedded link (Speaker (MMM YYYY) format)
  const citationText = `${segment.speaker} (${month} ${year})`;
  
  // Build markdown with embedded link in citation (no dash) using curly quotes
  const markdown = `> ${formatQuoteText(segment.text)}  \n[${citationText}](${link})`;
  
  return {
    text: citationText,
    link,
    markdown,
  };
}

export function formatTimeForDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}