/**
 * In-Memory Storage System
 * Temporary solution for Railway deployment without database dependencies
 * Allows full functionality without Supabase connection
 */

import { VideoSource, Quote, Transcript } from './types';

// In-memory storage
const memoryStorage = {
  sources: new Map<string, VideoSource>(),
  quotes: new Map<string, Quote>(),
  transcripts: new Map<string, Transcript>(),
  progress: new Map<string, any>()
};

// Sources management
export const memorySources = {
  async create(source: VideoSource): Promise<VideoSource> {
    memoryStorage.sources.set(source.id, source);
    console.log(`💾 Memory: Stored source ${source.id} (${source.title})`);
    return source;
  },

  async update(id: string, updates: Partial<VideoSource>): Promise<VideoSource | null> {
    const existing = memoryStorage.sources.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    memoryStorage.sources.set(id, updated);
    console.log(`💾 Memory: Updated source ${id}`);
    return updated;
  },

  async findById(id: string): Promise<VideoSource | null> {
    return memoryStorage.sources.get(id) || null;
  },

  async findAll(): Promise<VideoSource[]> {
    return Array.from(memoryStorage.sources.values());
  },

  async delete(id: string): Promise<boolean> {
    const deleted = memoryStorage.sources.delete(id);
    if (deleted) {
      console.log(`💾 Memory: Deleted source ${id}`);
    }
    return deleted;
  }
};

// Quotes management
export const memoryQuotes = {
  async create(quote: Quote): Promise<Quote> {
    memoryStorage.quotes.set(quote.id, quote);
    console.log(`💾 Memory: Stored quote ${quote.id}`);
    return quote;
  },

  async update(id: string, updates: Partial<Quote>): Promise<Quote | null> {
    const existing = memoryStorage.quotes.get(id);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    memoryStorage.quotes.set(id, updated);
    console.log(`💾 Memory: Updated quote ${id}`);
    return updated;
  },

  async findById(id: string): Promise<Quote | null> {
    return memoryStorage.quotes.get(id) || null;
  },

  async findBySourceId(sourceId: string): Promise<Quote[]> {
    return Array.from(memoryStorage.quotes.values()).filter(q => q.sourceId === sourceId);
  },

  async findAll(): Promise<Quote[]> {
    return Array.from(memoryStorage.quotes.values());
  },

  async delete(id: string): Promise<boolean> {
    const deleted = memoryStorage.quotes.delete(id);
    if (deleted) {
      console.log(`💾 Memory: Deleted quote ${id}`);
    }
    return deleted;
  },

  async deleteBySourceId(sourceId: string): Promise<number> {
    const quotes = Array.from(memoryStorage.quotes.values()).filter(q => q.sourceId === sourceId);
    let deleted = 0;
    quotes.forEach(quote => {
      if (memoryStorage.quotes.delete(quote.id)) {
        deleted++;
      }
    });
    console.log(`💾 Memory: Deleted ${deleted} quotes for source ${sourceId}`);
    return deleted;
  }
};

// Transcripts management
export const memoryTranscripts = {
  async save(transcript: Transcript): Promise<Transcript> {
    memoryStorage.transcripts.set(transcript.sourceId, transcript);
    console.log(`💾 Memory: Stored transcript for ${transcript.sourceId} (${transcript.segments.length} segments)`);
    return transcript;
  },

  async load(sourceId: string): Promise<Transcript | null> {
    return memoryStorage.transcripts.get(sourceId) || null;
  },

  async delete(sourceId: string): Promise<boolean> {
    const deleted = memoryStorage.transcripts.delete(sourceId);
    if (deleted) {
      console.log(`💾 Memory: Deleted transcript for ${sourceId}`);
    }
    return deleted;
  },

  async findAll(): Promise<Transcript[]> {
    return Array.from(memoryStorage.transcripts.values());
  }
};

// Progress management
export const memoryProgress = {
  async set(sourceId: string, progress: any): Promise<void> {
    memoryStorage.progress.set(sourceId, progress);
    console.log(`💾 Memory: Updated progress for ${sourceId}: ${progress.progress}%`);
  },

  async get(sourceId: string): Promise<any | null> {
    return memoryStorage.progress.get(sourceId) || null;
  },

  async delete(sourceId: string): Promise<boolean> {
    return memoryStorage.progress.delete(sourceId);
  }
};

// Stats and utilities
export const memoryStats = {
  getSummary() {
    return {
      sources: memoryStorage.sources.size,
      quotes: memoryStorage.quotes.size,
      transcripts: memoryStorage.transcripts.size,
      progressTracking: memoryStorage.progress.size,
      timestamp: new Date().toISOString()
    };
  },

  clear() {
    memoryStorage.sources.clear();
    memoryStorage.quotes.clear();
    memoryStorage.transcripts.clear();
    memoryStorage.progress.clear();
    console.log('💾 Memory: Cleared all storage');
  }
};

// Export unified interface
export const memoryStorage_ = {
  sources: memorySources,
  quotes: memoryQuotes,
  transcripts: memoryTranscripts,
  progress: memoryProgress,
  stats: memoryStats
};