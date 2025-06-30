/**
 * Migration utilities for video source data structure updates
 * Ensures backwards compatibility with existing data
 */

import { VideoSource } from './types';

/**
 * Migrates existing VideoSource objects to include new video validation fields
 */
export function migrateVideoSource(source: any): VideoSource {
  // Ensure all required new fields exist with proper defaults
  const migrated: VideoSource = {
    ...source,
    videoStatus: source.videoStatus || 'loading',
    transcriptStatus: source.transcriptStatus || (
      source.status === 'ready' ? 'ready' :
      source.status === 'transcribing' ? 'transcribing' :
      source.status === 'error' ? 'error' :
      'pending'
    ),
    videoRetryCount: source.videoRetryCount || 0,
    lastVideoCheck: source.lastVideoCheck ? new Date(source.lastVideoCheck) : undefined,
    // Keep existing fields
    addedAt: source.addedAt ? new Date(source.addedAt) : new Date(),
    uploadDate: source.uploadDate ? new Date(source.uploadDate) : undefined,
  };

  // If source was previously marked as 'ready', we need to validate video status
  if (source.status === 'ready' && !source.videoStatus) {
    migrated.videoStatus = 'loading'; // Will be validated by useVideoValidator
  }

  return migrated;
}

/**
 * Migrates an array of video sources
 */
export function migrateVideoSources(sources: any[]): VideoSource[] {
  return sources.map(migrateVideoSource);
}

/**
 * Checks if a video source needs migration
 */
export function needsMigration(source: any): boolean {
  return !source.videoStatus || !source.transcriptStatus || source.videoRetryCount === undefined;
}

/**
 * Migrates localStorage data to new format
 */
export function migrateLocalStorageData(): void {
  if (typeof window === 'undefined') return;

  try {
    const sourcesData = localStorage.getItem('quote-extractor-sources');
    if (sourcesData) {
      const sources = JSON.parse(sourcesData);
      if (Array.isArray(sources) && sources.some(needsMigration)) {
        const migratedSources = migrateVideoSources(sources);
        localStorage.setItem('quote-extractor-sources', JSON.stringify(migratedSources));
        console.log('Migrated video sources to new format');
      }
    }
  } catch (error) {
    console.error('Error migrating localStorage data:', error);
  }
}