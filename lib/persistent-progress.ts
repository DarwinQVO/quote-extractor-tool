/**
 * Persistent Progress Tracking System
 * Enterprise-grade solution for Railway production environment
 * Replaces in-memory Map with Supabase persistence + Redis-like caching
 */

import { createClient } from '@supabase/supabase-js';

// Progress state interface
export interface TranscriptionProgress {
  sourceId: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  stage: 'initializing' | 'extracting' | 'transcribing' | 'enhancing' | 'saving' | 'done';
  message?: string;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
  retryCount?: number;
}

// In-memory cache for performance (ephemeral, but fast for concurrent requests)
const progressCache = new Map<string, TranscriptionProgress>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cacheTimestamps = new Map<string, number>();

// Initialize Supabase client for persistence
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase not configured - progress tracking disabled');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Initialize transcription progress
 */
export async function initializeProgress(sourceId: string): Promise<void> {
  const progress: TranscriptionProgress = {
    sourceId,
    progress: 0,
    status: 'pending',
    stage: 'initializing',
    message: 'Initializing transcription process...',
    startedAt: new Date(),
    updatedAt: new Date(),
    retryCount: 0
  };

  // Cache immediately for fast access
  progressCache.set(sourceId, progress);
  cacheTimestamps.set(sourceId, Date.now());

  // Persist to database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('transcription_progress')
        .upsert({
          source_id: sourceId,
          progress: progress.progress,
          status: progress.status,
          stage: progress.stage,
          message: progress.message,
          started_at: progress.startedAt.toISOString(),
          updated_at: progress.updatedAt.toISOString(),
          retry_count: progress.retryCount
        });
    } catch (error) {
      console.error('Failed to persist progress initialization:', error);
      // Continue with cache-only operation
    }
  }
}

/**
 * Update transcription progress
 */
export async function updateProgress(
  sourceId: string,
  progress: number,
  stage: TranscriptionProgress['stage'],
  message?: string
): Promise<void> {
  const current = progressCache.get(sourceId) || {
    sourceId,
    progress: 0,
    status: 'processing' as const,
    stage: 'initializing' as const,
    startedAt: new Date(),
    updatedAt: new Date(),
    retryCount: 0
  };

  const updated: TranscriptionProgress = {
    ...current,
    progress: Math.min(100, Math.max(0, progress)),
    status: progress >= 100 ? 'completed' : 'processing',
    stage,
    message,
    updatedAt: new Date(),
    ...(progress >= 100 && { completedAt: new Date() })
  };

  // Update cache
  progressCache.set(sourceId, updated);
  cacheTimestamps.set(sourceId, Date.now());

  // Persist to database (non-blocking)
  const supabase = getSupabaseClient();
  if (supabase) {
    setImmediate(async () => {
      try {
        await supabase
          .from('transcription_progress')
          .upsert({
            source_id: sourceId,
            progress: updated.progress,
            status: updated.status,
            stage: updated.stage,
            message: updated.message,
            started_at: updated.startedAt.toISOString(),
            updated_at: updated.updatedAt.toISOString(),
            completed_at: updated.completedAt?.toISOString() || null,
            retry_count: updated.retryCount
          });
      } catch (error) {
        console.error('Failed to persist progress update:', error);
      }
    });
  }
}

/**
 * Mark transcription as failed
 */
export async function markProgressError(
  sourceId: string,
  errorMessage: string,
  stage: TranscriptionProgress['stage']
): Promise<void> {
  const current = progressCache.get(sourceId) || {
    sourceId,
    progress: 0,
    status: 'error' as const,
    stage,
    startedAt: new Date(),
    updatedAt: new Date(),
    retryCount: 0
  };

  const updated: TranscriptionProgress = {
    ...current,
    status: 'error',
    stage,
    errorMessage,
    updatedAt: new Date(),
    retryCount: (current.retryCount || 0) + 1
  };

  // Update cache
  progressCache.set(sourceId, updated);
  cacheTimestamps.set(sourceId, Date.now());

  // Persist to database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('transcription_progress')
        .upsert({
          source_id: sourceId,
          progress: updated.progress,
          status: updated.status,
          stage: updated.stage,
          message: updated.errorMessage,
          error_message: updated.errorMessage,
          started_at: updated.startedAt.toISOString(),
          updated_at: updated.updatedAt.toISOString(),
          retry_count: updated.retryCount
        });
    } catch (error) {
      console.error('Failed to persist progress error:', error);
    }
  }
}

/**
 * Get current transcription progress
 */
export async function getProgress(sourceId: string): Promise<TranscriptionProgress | null> {
  // Check cache first
  const cached = progressCache.get(sourceId);
  const cacheTime = cacheTimestamps.get(sourceId) || 0;
  
  if (cached && (Date.now() - cacheTime) < CACHE_TTL) {
    return cached;
  }

  // Fallback to database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transcription_progress')
        .select('*')
        .eq('source_id', sourceId)
        .single();

      if (error) {
        console.error('Failed to fetch progress from database:', error);
        return cached || null;
      }

      if (data) {
        const progress: TranscriptionProgress = {
          sourceId: data.source_id,
          progress: data.progress,
          status: data.status,
          stage: data.stage,
          message: data.message,
          startedAt: new Date(data.started_at),
          updatedAt: new Date(data.updated_at),
          completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
          errorMessage: data.error_message,
          retryCount: data.retry_count
        };

        // Update cache
        progressCache.set(sourceId, progress);
        cacheTimestamps.set(sourceId, Date.now());

        return progress;
      }
    } catch (error) {
      console.error('Failed to query progress from database:', error);
    }
  }

  return cached || null;
}

/**
 * Clean up completed progress (older than 24 hours)
 */
export async function cleanupOldProgress(): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    await supabase
      .from('transcription_progress')
      .delete()
      .in('status', ['completed', 'error'])
      .lt('updated_at', oneDayAgo.toISOString());
  } catch (error) {
    console.error('Failed to cleanup old progress:', error);
  }

  // Clean cache as well
  for (const [sourceId, timestamp] of cacheTimestamps) {
    if (Date.now() - timestamp > CACHE_TTL) {
      progressCache.delete(sourceId);
      cacheTimestamps.delete(sourceId);
    }
  }
}

/**
 * Delete specific progress
 */
export async function deleteProgress(sourceId: string): Promise<void> {
  // Remove from cache
  progressCache.delete(sourceId);
  cacheTimestamps.delete(sourceId);

  // Remove from database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase
        .from('transcription_progress')
        .delete()
        .eq('source_id', sourceId);
    } catch (error) {
      console.error('Failed to delete progress from database:', error);
    }
  }
}

/**
 * Legacy compatibility layer for existing code
 */
export function setProgress(sourceId: string, progress: number): void {
  // Convert to async operation
  updateProgress(sourceId, progress, 'processing').catch(console.error);
}

export function getProgressSync(sourceId: string): number {
  const cached = progressCache.get(sourceId);
  return cached?.progress || 0;
}