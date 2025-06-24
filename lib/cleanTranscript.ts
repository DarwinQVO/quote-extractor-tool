import { Segment } from './types';

// Enhanced filler words list
const FILLER_WORDS = /\b(uh|um|ah|er|hmm|you know|like|I mean|basically|actually|literally|right\?|okay\?|sort of|kind of|you see|well|so|and then|and stuff|and things|whatever)\b/gi;

// Regex patterns for instant transformations
const TRANSFORMATIONS = [
  // Numbers: over/more than → >
  { pattern: /\b(over|more than)\s+(\$?\d+(?:,\d{3})*(?:\.\d+)?[KMB]?)\b/gi, replacement: '>$2' },
  
  // Numbers: less than → <
  { pattern: /\b(less than)\s+(\$?\d+(?:,\d{3})*(?:\.\d+)?[KMB]?)\b/gi, replacement: '<$2' },
  
  // Numbers: approximately/around → ∼
  { pattern: /\b(approximately|around|about)\s+(\$?\d+(?:,\d{3})*(?:\.\d+)?[KMB]?)\b/gi, replacement: '∼$2' },
  
  // Percentage → %
  { pattern: /\b(\d+(?:\.\d+)?)\s*percent(age)?\b/gi, replacement: '$1%' },
  
  // Per → /
  { pattern: /\b(\$?\d+(?:,\d{3})*(?:\.\d+)?[KMB]?)\s+per\s+(month|year|day|week|hour|minute)\b/gi, replacement: '$1/$2' },
  
  // Ordinals: first → 1st, second → 2nd, third → 3rd
  { pattern: /\bfirst\b/gi, replacement: '1st' },
  { pattern: /\bsecond\b/gi, replacement: '2nd' },
  { pattern: /\bthird\b/gi, replacement: '3rd' },
  { pattern: /\bfourth\b/gi, replacement: '4th' },
  { pattern: /\bfifth\b/gi, replacement: '5th' },
  { pattern: /\bsixth\b/gi, replacement: '6th' },
  { pattern: /\bseventh\b/gi, replacement: '7th' },
  { pattern: /\beighth\b/gi, replacement: '8th' },
  { pattern: /\bninth\b/gi, replacement: '9th' },
  { pattern: /\btenth\b/gi, replacement: '10th' },
  
  // Written numbers → digits
  { pattern: /\bone\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '1' },
  { pattern: /\btwo\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '2' },
  { pattern: /\bthree\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '3' },
  { pattern: /\bfour\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '4' },
  { pattern: /\bfive\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '5' },
  { pattern: /\bsix\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '6' },
  { pattern: /\bseven\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '7' },
  { pattern: /\beight\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '8' },
  { pattern: /\bnine\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '9' },
  { pattern: /\bten\b(?!\s+(hundred|thousand|million|billion))/gi, replacement: '10' },
  { pattern: /\beleven\b/gi, replacement: '11' },
  { pattern: /\btwelve\b/gi, replacement: '12' },
  { pattern: /\bthirteen\b/gi, replacement: '13' },
  { pattern: /\bfourteen\b/gi, replacement: '14' },
  { pattern: /\bfifteen\b/gi, replacement: '15' },
  { pattern: /\bsixteen\b/gi, replacement: '16' },
  { pattern: /\bseventeen\b/gi, replacement: '17' },
  { pattern: /\beighteen\b/gi, replacement: '18' },
  { pattern: /\bnineteen\b/gi, replacement: '19' },
  { pattern: /\btwenty\b/gi, replacement: '20' },
  
  // Multipliers: doubled → 2x, tripled → 3x
  { pattern: /\b(doubled|increased by two fold)\b/gi, replacement: '2x' },
  { pattern: /\b(tripled|increased by three fold)\b/gi, replacement: '3x' },
  { pattern: /\b(quadrupled|increased by four fold)\b/gi, replacement: '4x' },
  { pattern: /\bincreased by (\d+) fold\b/gi, replacement: '$1x' },
  
  // Large numbers formatting: billions → B, millions → M, thousands → K
  { pattern: /\b(\d+(?:\.\d+)?)\s*billion\b/gi, replacement: '$1B' },
  { pattern: /\b(\d+(?:\.\d+)?)\s*million\b/gi, replacement: '$1M' },
  { pattern: /\b(\d+(?:\.\d+)?)\s*thousand\b/gi, replacement: '$1K' },
  
  // Currency formatting
  { pattern: /\$\s*(\d+)/g, replacement: '$$$1' }, // Remove space between $ and number
];

const EXTRA_SPACES = /\s+/g;
const DANGLING_PUNCTUATION = /\s+([.,!?;:])/g;
const STARTING_PUNCTUATION = /^[.,!?;:]+/;
const ENDING_PUNCTUATION = /[.,!?;:]+$/;

export function cleanTranscriptText(text: string): string {
  let cleaned = text;
  
  // Apply all regex transformations first
  TRANSFORMATIONS.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });
  
  cleaned = cleaned
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

// AI Enhancement System with Fallbacks
export interface TranscriptEnhancementOptions {
  enableAIEnhancement: boolean;
  videoContext?: {
    title: string;
    channel: string;
    speakers?: string[];
    topic?: string;
  };
}

export async function enhanceTranscriptWithAI(
  text: string, 
  options: TranscriptEnhancementOptions
): Promise<string> {
  if (!options.enableAIEnhancement) {
    return cleanTranscriptText(text);
  }

  try {
    // Check if OpenAI is available
    const response = await fetch('/api/enhance-transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        context: options.videoContext
      }),
    });

    if (!response.ok) {
      throw new Error('AI enhancement failed');
    }

    const { enhancedText } = await response.json();
    return enhancedText || cleanTranscriptText(text);
    
  } catch (error) {
    console.warn('AI enhancement failed, using basic cleaning:', error);
    // Fallback to basic cleaning
    return cleanTranscriptText(text);
  }
}

export function enhanceSegmentsWithAI(
  segments: Segment[], 
  options: TranscriptEnhancementOptions
): Promise<Segment[]> {
  if (!options.enableAIEnhancement) {
    return Promise.resolve(cleanSegments(segments));
  }

  // Process segments in batches to avoid API limits
  return Promise.all(
    segments.map(async (segment) => {
      try {
        const enhancedText = await enhanceTranscriptWithAI(segment.text, options);
        return { ...segment, text: enhancedText };
      } catch (error) {
        console.warn('Failed to enhance segment, using basic cleaning:', error);
        return { ...segment, text: cleanTranscriptText(segment.text) };
      }
    })
  );
}