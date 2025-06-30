/**
 * Enterprise-level video validation and recovery system
 * Ensures video-transcript synchronization and prevents loading failures
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/lib/store';
import { VideoSource } from '@/lib/types';
import { toast } from './use-toast';

interface VideoValidationResult {
  isValid: boolean;
  error?: string;
  canRetry: boolean;
  alternativeUrl?: string;
}

interface UseVideoValidatorReturn {
  validateVideo: (source: VideoSource) => Promise<VideoValidationResult>;
  isValidating: boolean;
  retryVideoLoad: (sourceId: string) => Promise<void>;
  forceVideoRefresh: (sourceId: string) => Promise<void>;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;
const VIDEO_CHECK_TIMEOUT = 10000;

export function useVideoValidator(): UseVideoValidatorReturn {
  const [isValidating, setIsValidating] = useState(false);
  const { updateSource, sources } = useStore();
  const validationCache = useRef<Map<string, { result: VideoValidationResult; timestamp: number }>>(new Map());
  const retryTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Validates if a YouTube video is actually accessible
   */
  const validateVideoAccess = useCallback(async (url: string): Promise<VideoValidationResult> => {
    try {
      // Extract video ID
      const videoIdMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
      if (!videoIdMatch) {
        return { isValid: false, error: 'Invalid YouTube URL format', canRetry: false };
      }

      const videoId = videoIdMatch[1];
      
      // Check if video exists and is accessible via YouTube API
      const response = await fetch(`/api/youtube/validate?videoId=${videoId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { 
          isValid: false, 
          error: errorData.error || 'Video validation failed', 
          canRetry: response.status >= 500 // Server errors can be retried
        };
      }

      const validation = await response.json();
      
      if (!validation.available) {
        return {
          isValid: false,
          error: validation.reason || 'Video not available',
          canRetry: validation.canRetry || false,
          alternativeUrl: validation.alternativeUrl
        };
      }

      return { isValid: true, canRetry: false };

    } catch (error) {
      console.error('Video validation error:', error);
      return { 
        isValid: false, 
        error: 'Network error during validation', 
        canRetry: true 
      };
    }
  }, []);

  /**
   * Validates video with caching and retry logic
   */
  const validateVideo = useCallback(async (source: VideoSource): Promise<VideoValidationResult> => {
    setIsValidating(true);
    
    try {
      // Check cache first (5 minute cache)
      const cached = validationCache.current.get(source.url);
      if (cached && Date.now() - cached.timestamp < 300000) {
        return cached.result;
      }

      // Update source status to indicate video checking
      updateSource(source.id, { 
        videoStatus: 'loading',
        lastVideoCheck: new Date()
      });

      const result = await validateVideoAccess(source.url);
      
      // Cache result
      validationCache.current.set(source.url, {
        result,
        timestamp: Date.now()
      });

      // Update source based on validation result
      if (result.isValid) {
        updateSource(source.id, {
          videoStatus: 'ready',
          videoError: undefined,
          videoRetryCount: 0
        });
      } else {
        updateSource(source.id, {
          videoStatus: result.canRetry ? 'error' : 'unavailable',
          videoError: result.error,
          videoRetryCount: (source.videoRetryCount || 0) + 1
        });

        // Show user feedback
        toast({
          title: 'Video Loading Issue',
          description: result.error,
          variant: result.canRetry ? 'default' : 'destructive',
        });
      }

      return result;

    } catch (error) {
      console.error('Validation process error:', error);
      
      updateSource(source.id, {
        videoStatus: 'error',
        videoError: 'Validation failed',
        videoRetryCount: (source.videoRetryCount || 0) + 1
      });

      return { 
        isValid: false, 
        error: 'Validation process failed', 
        canRetry: true 
      };
    } finally {
      setIsValidating(false);
    }
  }, [updateSource]);

  /**
   * Retries video loading with exponential backoff
   */
  const retryVideoLoad = useCallback(async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    const retryCount = source.videoRetryCount || 0;
    if (retryCount >= MAX_RETRY_ATTEMPTS) {
      toast({
        title: 'Max Retries Reached',
        description: 'Video cannot be loaded after multiple attempts',
        variant: 'destructive',
      });
      
      updateSource(sourceId, { videoStatus: 'unavailable' });
      return;
    }

    // Clear any existing retry timeout
    const existingTimeout = retryTimeouts.current.get(sourceId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Exponential backoff
    const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
    
    toast({
      title: 'Retrying Video Load',
      description: `Attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS} in ${delay/1000}s`,
    });

    const timeout = setTimeout(async () => {
      await validateVideo(source);
      retryTimeouts.current.delete(sourceId);
    }, delay);

    retryTimeouts.current.set(sourceId, timeout);
  }, [sources, updateSource, validateVideo]);

  /**
   * Forces a fresh video validation, bypassing cache
   */
  const forceVideoRefresh = useCallback(async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;

    // Clear cache for this video
    validationCache.current.delete(source.url);
    
    // Reset retry count
    updateSource(sourceId, { videoRetryCount: 0 });
    
    await validateVideo(source);
  }, [sources, updateSource, validateVideo]);

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      retryTimeouts.current.forEach(timeout => clearTimeout(timeout));
      retryTimeouts.current.clear();
    };
  }, []);

  return {
    validateVideo,
    isValidating,
    retryVideoLoad,
    forceVideoRefresh,
  };
}