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

// Speaker identification patterns
const SPEAKER_PATTERNS = {
  interviewer: /\b(so|now|tell me|what|how|why|when|where|can you|would you|could you|do you|are you|have you|thanks|thank you|that's interesting|I see)\b/i,
  interviewee: /\b(well|actually|I think|I believe|in my opinion|from my experience|personally|you know|basically|fundamentally|essentially)\b/i,
  host: /\b(welcome|today|we have|our guest|next|moving on|before we wrap up|that's all|thanks for watching|don't forget to)\b/i,
  presenter: /\b(hello everyone|good morning|good afternoon|today we're going to|let's start|first|second|third|in conclusion|to summarize)\b/i,
  narrator: /\b(meanwhile|later|earlier|subsequently|consequently|therefore|however|moreover|furthermore|in addition)\b/i
};

const QUESTION_PATTERNS = /[?]|^(what|how|why|when|where|who|which|can|could|would|should|do|does|did|is|are|was|were|have|has|had|will)\b/i;
const STATEMENT_PATTERNS = /[.]|^(I|we|this|that|it|there|here)\b/i;

export function performAdvancedDiarization(segments: Segment[]): Segment[] {
  if (segments.length === 0) return segments;
  
  const diarizedSegments: Segment[] = [];
  const speakerTypes: string[] = [];
  
  // First pass: identify speaker types based on speech patterns
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const text = segment.text.toLowerCase();
    
    let speakerType = 'Speaker';
    
    // Check for specific speaker patterns
    if (SPEAKER_PATTERNS.host.test(text)) {
      speakerType = 'Host';
    } else if (SPEAKER_PATTERNS.interviewer.test(text) || QUESTION_PATTERNS.test(text)) {
      speakerType = 'Interviewer';
    } else if (SPEAKER_PATTERNS.interviewee.test(text)) {
      speakerType = 'Guest';
    } else if (SPEAKER_PATTERNS.presenter.test(text)) {
      speakerType = 'Presenter';
    } else if (SPEAKER_PATTERNS.narrator.test(text)) {
      speakerType = 'Narrator';
    }
    
    speakerTypes.push(speakerType);
  }
  
  // Second pass: apply speaker continuity and context
  let currentSpeaker = speakerTypes[0] || 'Speaker';
  const speakerCount = { [currentSpeaker]: 1 };
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const prevSegment = segments[i - 1];
    const suggestedType = speakerTypes[i];
    
    // Determine if speaker changed based on multiple factors
    let speakerChanged = false;
    
    if (prevSegment) {
      const gap = segment.start - prevSegment.end;
      
      // Speaker change indicators:
      // 1. Long pause (> 1.5s) with different speaker type
      // 2. Question followed by statement (interview pattern)
      // 3. Different speaker type with significant content change
      
      if (gap > 1.5 && suggestedType !== currentSpeaker) {
        speakerChanged = true;
      } else if (gap > 0.8) {
        const prevIsQuestion = QUESTION_PATTERNS.test(prevSegment.text);
        const currentIsStatement = STATEMENT_PATTERNS.test(segment.text);
        if (prevIsQuestion && currentIsStatement) {
          speakerChanged = true;
        }
      }
    }
    
    if (speakerChanged) {
      // Use suggested type or alternate between main speakers
      if (suggestedType && suggestedType !== 'Speaker') {
        currentSpeaker = suggestedType;
      } else {
        // Find the most appropriate speaker name
        const commonTypes = Object.keys(speakerCount).sort((a, b) => speakerCount[b] - speakerCount[a]);
        if (commonTypes.length > 1) {
          currentSpeaker = commonTypes.find(type => type !== currentSpeaker) || 'Speaker B';
        } else {
          currentSpeaker = currentSpeaker.includes('Host') ? 'Guest' : 'Host';
        }
      }
    }
    
    // Update speaker count
    if (!speakerCount[currentSpeaker]) {
      speakerCount[currentSpeaker] = 0;
    }
    speakerCount[currentSpeaker]++;
    
    diarizedSegments.push({
      ...segment,
      speaker: currentSpeaker
    });
  }
  
  return diarizedSegments;
}

export function performBasicDiarization(segments: Segment[]): Segment[] {
  // Use the advanced diarization instead
  return performAdvancedDiarization(segments);
}