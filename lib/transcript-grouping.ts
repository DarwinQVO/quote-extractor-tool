/**
 * Intelligent Transcript Grouping System
 * Optimizes visual flow by grouping consecutive speaker segments
 */

import { Segment, TranscriptWord } from './types';

export interface GroupedSegment {
  id: string;
  speaker: string;
  startTime: number;
  endTime: number;
  segments: Segment[];
  combinedText: string;
  wordCount: number;
  duration: number;
}

export interface TranscriptGroup {
  speaker: string;
  segments: GroupedSegment[];
  totalDuration: number;
  totalWords: number;
}

/**
 * Configuration for grouping behavior
 */
export interface GroupingConfig {
  maxGapBetweenSegments: number; // Maximum time gap (seconds) between segments to group
  maxSegmentsPerGroup: number;   // Maximum segments in a single group
  minSegmentDuration: number;    // Minimum duration to consider a segment significant
  groupShortSegments: boolean;   // Whether to group very short segments
}

const DEFAULT_GROUPING_CONFIG: GroupingConfig = {
  maxGapBetweenSegments: 5,      // 5 seconds max gap - crear saltos en pausas
  maxSegmentsPerGroup: 15,       // Max 15 segments per group - bloques más pequeños  
  minSegmentDuration: 0.5,       // 0.5 seconds minimum
  groupShortSegments: true,      // Group short segments by default
};

/**
 * Groups transcript segments ONLY by speaker change - mantiene bloques completos
 */
export function groupTranscriptSegments(
  segments: Segment[],
  config: Partial<GroupingConfig> = {}
): GroupedSegment[] {
  const groupedSegments: GroupedSegment[] = [];
  
  if (segments.length === 0) return groupedSegments;

  let currentGroup: Segment[] = [segments[0]];
  let currentSpeaker = segments[0].speaker;
  let groupId = 1;

  for (let i = 1; i < segments.length; i++) {
    const currentSegment = segments[i];
    
    // ONLY group by speaker change - mantener bloques completos
    const speakerChanged = currentSegment.speaker !== currentSpeaker;
    
    if (speakerChanged) {
      // Finalize current group
      groupedSegments.push(createGroupedSegment(currentGroup, groupId.toString()));
      groupId++;
      
      // Start new group
      currentGroup = [currentSegment];
      currentSpeaker = currentSegment.speaker;
    } else {
      // Same speaker - add to current group
      currentGroup.push(currentSegment);
    }
  }

  // Add the last group
  if (currentGroup.length > 0) {
    groupedSegments.push(createGroupedSegment(currentGroup, groupId.toString()));
  }

  return groupedSegments;
}

/**
 * Creates a grouped segment from multiple individual segments
 */
function createGroupedSegment(segments: Segment[], id: string): GroupedSegment {
  const startTime = segments[0].start;
  const endTime = segments[segments.length - 1].end;
  const combinedText = segments.map(s => s.text).join(' ').trim();
  const wordCount = combinedText.split(/\s+/).length;
  const duration = endTime - startTime;

  return {
    id,
    speaker: segments[0].speaker,
    startTime,
    endTime,
    segments,
    combinedText,
    wordCount,
    duration,
  };
}

/**
 * Groups segments by speaker for overview/statistics
 */
export function groupSegmentsBySpeaker(segments: Segment[]): TranscriptGroup[] {
  const speakerGroups = new Map<string, Segment[]>();
  
  // Group segments by speaker
  segments.forEach(segment => {
    if (!speakerGroups.has(segment.speaker)) {
      speakerGroups.set(segment.speaker, []);
    }
    speakerGroups.get(segment.speaker)!.push(segment);
  });

  // Convert to TranscriptGroup format
  return Array.from(speakerGroups.entries()).map(([speaker, speakerSegments]) => {
    const groupedSegments = groupTranscriptSegments(speakerSegments);
    const totalDuration = speakerSegments.reduce((sum, s) => sum + (s.end - s.start), 0);
    const totalWords = speakerSegments.reduce((sum, s) => sum + s.text.split(/\s+/).length, 0);

    return {
      speaker,
      segments: groupedSegments,
      totalDuration,
      totalWords,
    };
  });
}

/**
 * Optimizes word-level grouping for better visual flow
 */
export function groupWordsByOptimizedSegments(
  words: TranscriptWord[],
  segments: Segment[]
): Array<{ segment: GroupedSegment; words: TranscriptWord[] }> {
  const groupedSegments = groupTranscriptSegments(segments);
  const result: Array<{ segment: GroupedSegment; words: TranscriptWord[] }> = [];

  groupedSegments.forEach(groupedSegment => {
    const segmentWords = words.filter(word => 
      word.start >= groupedSegment.startTime && 
      word.end <= groupedSegment.endTime
    );
    
    result.push({
      segment: groupedSegment,
      words: segmentWords,
    });
  });

  return result;
}

/**
 * Analyzes transcript flow and suggests optimization opportunities
 */
export function analyzeTranscriptFlow(segments: Segment[]): {
  totalSegments: number;
  speakerChanges: number;
  avgSegmentDuration: number;
  shortSegments: number;
  potentialGroupings: number;
  speakers: string[];
} {
  const speakerChanges = segments.reduce((count, segment, index) => {
    if (index > 0 && segment.speaker !== segments[index - 1].speaker) {
      return count + 1;
    }
    return count;
  }, 0);

  const avgSegmentDuration = segments.reduce((sum, s) => sum + (s.end - s.start), 0) / segments.length;
  const shortSegments = segments.filter(s => (s.end - s.start) < 3).length;
  const uniqueSpeakers = [...new Set(segments.map(s => s.speaker))];
  
  // Estimate potential groupings (consecutive same-speaker segments)
  let potentialGroupings = 0;
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].speaker === segments[i - 1].speaker) {
      potentialGroupings++;
    }
  }

  return {
    totalSegments: segments.length,
    speakerChanges,
    avgSegmentDuration,
    shortSegments,
    potentialGroupings,
    speakers: uniqueSpeakers,
  };
}

/**
 * Formats time for display in grouped segments
 */
export function formatTimeRange(startTime: number, endTime: number): string {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return `${formatTime(startTime)} - ${formatTime(endTime)}`;
}

/**
 * Calculates reading time estimate for grouped segments
 */
export function estimateReadingTime(groupedSegment: GroupedSegment): string {
  const wordsPerMinute = 200; // Average reading speed
  const minutes = Math.ceil(groupedSegment.wordCount / wordsPerMinute);
  
  if (minutes < 1) return '< 1 min read';
  if (minutes === 1) return '1 min read';
  return `${minutes} min read`;
}

/**
 * Generates summary statistics for grouped transcript
 */
export function generateGroupingSummary(groupedSegments: GroupedSegment[]): {
  totalGroups: number;
  avgWordsPerGroup: number;
  avgDurationPerGroup: number;
  speakers: string[];
  groupsBySpeaker: Record<string, number>;
} {
  const totalWords = groupedSegments.reduce((sum, g) => sum + g.wordCount, 0);
  const totalDuration = groupedSegments.reduce((sum, g) => sum + g.duration, 0);
  const speakers = [...new Set(groupedSegments.map(g => g.speaker))];
  
  const groupsBySpeaker: Record<string, number> = {};
  groupedSegments.forEach(group => {
    groupsBySpeaker[group.speaker] = (groupsBySpeaker[group.speaker] || 0) + 1;
  });

  return {
    totalGroups: groupedSegments.length,
    avgWordsPerGroup: Math.round(totalWords / groupedSegments.length),
    avgDurationPerGroup: Math.round(totalDuration / groupedSegments.length),
    speakers,
    groupsBySpeaker,
  };
}