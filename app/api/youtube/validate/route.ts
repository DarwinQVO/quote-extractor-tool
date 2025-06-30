/**
 * YouTube Video Validation API
 * Checks if a video is accessible and provides fallback options
 */

import { NextRequest, NextResponse } from 'next/server';

interface ValidationResponse {
  available: boolean;
  reason?: string;
  canRetry: boolean;
  alternativeUrl?: string;
  metadata?: {
    title?: string;
    status?: string;
  };
}

// Common reasons for video unavailability
const UNAVAILABLE_REASONS = {
  PRIVATE: 'Video is private',
  DELETED: 'Video has been deleted',
  REGION_BLOCKED: 'Video not available in your region',
  AGE_RESTRICTED: 'Video is age-restricted',
  COPYRIGHT: 'Video removed due to copyright',
  LIVE_ENDED: 'Live stream has ended',
  PREMIUM_ONLY: 'Video requires YouTube Premium',
} as const;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId parameter is required' },
        { status: 400 }
      );
    }

    // Validate video ID format
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return NextResponse.json({
        available: false,
        reason: 'Invalid video ID format',
        canRetry: false,
      } as ValidationResponse);
    }

    const validation = await validateYouTubeVideo(videoId);
    return NextResponse.json(validation);

  } catch (error) {
    console.error('Video validation error:', error);
    
    return NextResponse.json({
      available: false,
      reason: 'Validation service error',
      canRetry: true,
    } as ValidationResponse, { status: 500 });
  }
}

async function validateYouTubeVideo(videoId: string): Promise<ValidationResponse> {
  try {
    // Method 1: Try YouTube oEmbed API (fastest, most reliable)
    const oembedResponse = await validateViaOEmbed(videoId);
    if (oembedResponse.available) {
      return oembedResponse;
    }

    // Method 2: Try direct YouTube Data API v3 (if configured)
    if (process.env.YOUTUBE_API_KEY) {
      const dataApiResponse = await validateViaDataAPI(videoId);
      if (dataApiResponse.available) {
        return dataApiResponse;
      }
    }

    // Method 3: Try yt-dlp validation (slower but comprehensive)
    const ytdlpResponse = await validateViaYtDlp(videoId);
    return ytdlpResponse;

  } catch (error) {
    console.error('All validation methods failed:', error);
    
    return {
      available: false,
      reason: 'Could not verify video availability',
      canRetry: true,
    };
  }
}

/**
 * Validate using YouTube oEmbed API (fastest method)
 */
async function validateViaOEmbed(videoId: string): Promise<ValidationResponse> {
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
    
    const response = await fetch(oembedUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoValidator/1.0)',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        canRetry: false,
        metadata: {
          title: data.title,
          status: 'public',
        },
      };
    }

    // Parse oEmbed error responses
    if (response.status === 404) {
      return {
        available: false,
        reason: UNAVAILABLE_REASONS.DELETED,
        canRetry: false,
      };
    }

    if (response.status === 401 || response.status === 403) {
      return {
        available: false,
        reason: UNAVAILABLE_REASONS.PRIVATE,
        canRetry: false,
      };
    }

    return {
      available: false,
      reason: `HTTP ${response.status}`,
      canRetry: response.status >= 500,
    };

  } catch (error) {
    console.error('oEmbed validation failed:', error);
    throw error;
  }
}

/**
 * Validate using YouTube Data API v3 (requires API key)
 */
async function validateViaDataAPI(videoId: string): Promise<ValidationResponse> {
  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      throw new Error('YouTube API key not configured');
    }

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=status,snippet`;
    
    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return {
        available: false,
        reason: UNAVAILABLE_REASONS.DELETED,
        canRetry: false,
      };
    }

    const video = data.items[0];
    const status = video.status;

    // Check various video status conditions
    if (!status.uploadStatus || status.uploadStatus !== 'processed') {
      return {
        available: false,
        reason: 'Video still processing',
        canRetry: true,
      };
    }

    if (status.privacyStatus === 'private') {
      return {
        available: false,
        reason: UNAVAILABLE_REASONS.PRIVATE,
        canRetry: false,
      };
    }

    if (status.embeddable === false) {
      return {
        available: false,
        reason: 'Video embedding disabled',
        canRetry: false,
      };
    }

    return {
      available: true,
      canRetry: false,
      metadata: {
        title: video.snippet?.title,
        status: status.privacyStatus,
      },
    };

  } catch (error) {
    console.error('YouTube Data API validation failed:', error);
    throw error;
  }
}

/**
 * Validate using yt-dlp (most comprehensive but slower)
 */
async function validateViaYtDlp(videoId: string): Promise<ValidationResponse> {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Use yt-dlp to check video availability
    const { stdout, stderr } = await execAsync(
      `yt-dlp --no-download --print "%(title)s|%(availability)s|%(live_status)s" "${url}"`,
      { timeout: 15000 }
    );

    if (stderr && stderr.includes('ERROR')) {
      // Parse yt-dlp errors
      if (stderr.includes('Private video')) {
        return {
          available: false,
          reason: UNAVAILABLE_REASONS.PRIVATE,
          canRetry: false,
        };
      }
      
      if (stderr.includes('Video unavailable')) {
        return {
          available: false,
          reason: UNAVAILABLE_REASONS.DELETED,
          canRetry: false,
        };
      }

      if (stderr.includes('blocked')) {
        return {
          available: false,
          reason: UNAVAILABLE_REASONS.REGION_BLOCKED,
          canRetry: false,
        };
      }

      return {
        available: false,
        reason: 'Video not accessible via yt-dlp',
        canRetry: true,
      };
    }

    const [title, availability, liveStatus] = stdout.trim().split('|');
    
    // Check availability status
    if (availability && availability !== 'public') {
      const reason = availability === 'private' ? UNAVAILABLE_REASONS.PRIVATE : 
                   availability === 'unlisted' ? 'Video is unlisted' :
                   `Video status: ${availability}`;
      
      return {
        available: false,
        reason,
        canRetry: false,
      };
    }

    // Check if it's a live stream that ended
    if (liveStatus === 'was_live') {
      return {
        available: false,
        reason: UNAVAILABLE_REASONS.LIVE_ENDED,
        canRetry: false,
      };
    }

    return {
      available: true,
      canRetry: false,
      metadata: {
        title: title || 'Unknown',
        status: availability || 'public',
      },
    };

  } catch (error) {
    console.error('yt-dlp validation failed:', error);
    
    // If timeout or command failed, assume it's a temporary issue
    return {
      available: false,
      reason: 'Video validation timeout',
      canRetry: true,
    };
  }
}