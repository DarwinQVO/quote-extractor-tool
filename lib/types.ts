export interface VideoSource {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  addedAt: Date;
  uploadDate?: Date;
  description?: string;
  viewCount?: number;
  status: 'pending' | 'fetching-metadata' | 'transcribing' | 'ready' | 'error';
  videoStatus: 'loading' | 'ready' | 'error' | 'unavailable';
  transcriptStatus: 'pending' | 'transcribing' | 'ready' | 'error';
  error?: string;
  videoError?: string;
  lastVideoCheck?: Date;
  videoRetryCount?: number;
}

export interface Quote {
  id: string;
  sourceId: string;
  text: string;
  speaker: string;
  startTime: number;
  endTime: number;
  citation: string;
  timestampLink: string;
  createdAt: Date;
  exported?: boolean;
}

export interface TranscriptWord {
  id: string;
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

export interface Segment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface Transcript {
  sourceId: string;
  segments: Segment[];
  words?: TranscriptWord[];
  speakers?: Array<{ id: string; label: string }>;
}