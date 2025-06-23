import { Segment } from './types';

const FILLER_WORDS = /\b(uh|um|ah|er|hmm|you know|like|I mean|basically|actually|literally|right\?|okay\?)\b/gi;
const EXTRA_SPACES = /\s+/g;
const DANGLING_PUNCTUATION = /\s+([.,!?;:])/g;
const STARTING_PUNCTUATION = /^[.,!?;:]+/;
const ENDING_PUNCTUATION = /[.,!?;:]+$/;

export function cleanTranscriptText(text: string): string {
  let cleaned = text
    // Remove filler words
    .replace(FILLER_WORDS, ' ')
    // Collapse multiple spaces
    .replace(EXTRA_SPACES, ' ')
    // Fix dangling punctuation
    .replace(DANGLING_PUNCTUATION, '$1')
    // Remove starting/ending punctuation
    .replace(STARTING_PUNCTUATION, '')
    .replace(ENDING_PUNCTUATION, '')
    .trim();
  
  // Ensure sentence ends with proper punctuation
  if (cleaned && !cleaned.match(/[.!?]$/)) {
    cleaned += '.';
  }
  
  return cleaned;
}

export function cleanSegments(segments: Segment[]): Segment[] {
  return segments
    .map(segment => ({
      ...segment,
      text: cleanTranscriptText(segment.text)
    }))
    .filter(segment => segment.text.length > 0);
}

export function performBasicDiarization(segments: Segment[]): Segment[] {
  if (segments.length === 0) return segments;
  
  let currentSpeaker = 1;
  const diarizedSegments: Segment[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const prevSegment = segments[i - 1];
    
    // If speaker is already assigned, keep it
    if (segment.speaker && segment.speaker !== 'Unknown') {
      diarizedSegments.push(segment);
      continue;
    }
    
    // Basic heuristic: new speaker if:
    // 1. Gap > 0.8s between segments AND
    // 2. Text starts with capital letter (new sentence)
    if (prevSegment) {
      const gap = segment.start - prevSegment.end;
      const startsWithCapital = /^[A-Z]/.test(segment.text.trim());
      
      if (gap > 0.8 && startsWithCapital) {
        currentSpeaker = currentSpeaker === 1 ? 2 : 1;
      }
    }
    
    diarizedSegments.push({
      ...segment,
      speaker: `Speaker ${currentSpeaker}`
    });
  }
  
  return diarizedSegments;
}