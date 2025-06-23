import { VideoSource, Segment } from './types';

export function buildCitation(
  source: VideoSource,
  segment: Segment,
  videoDate?: Date
): {
  text: string;
  link: string;
  markdown: string;
} {
  // Extract video ID from URL
  const videoIdMatch = source.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
  const videoId = videoIdMatch?.[1] || '';
  
  // Build timestamp link
  const timestampSeconds = Math.floor(segment.start);
  const link = `https://youtu.be/${videoId}?t=${timestampSeconds}`;
  
  // Format date
  const date = videoDate || source.addedAt;
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const year = date.getFullYear();
  
  // Build citation text
  const citationText = `${segment.speaker}, ${month} ${year}`;
  
  // Build markdown with link
  const markdown = `> "${segment.text}"  \n— [${citationText}](${link})`;
  
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