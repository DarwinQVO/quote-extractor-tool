/**
 * Production Health Check System
 * Enterprise-grade validation for Railway deployment
 * Ensures all critical services are available before starting transcription
 */

import { createClient } from '@supabase/supabase-js';

export interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'unhealthy' | 'warning';
  message: string;
  details?: any;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'unhealthy' | 'degraded';
  checks: HealthCheckResult[];
  timestamp: Date;
}

/**
 * Validate all required environment variables
 */
export function validateEnvironmentVariables(): HealthCheckResult {
  const required = {
    'OPENAI_API_KEY': process.env.OPENAI_API_KEY,
    'NEXT_PUBLIC_SUPABASE_URL': process.env.NEXT_PUBLIC_SUPABASE_URL,
    'NEXT_PUBLIC_SUPABASE_ANON_KEY': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  const optional = {
    'YTDLP_PROXY': process.env.YTDLP_PROXY,
    'YOUTUBE_API_KEY': process.env.YOUTUBE_API_KEY,
    'FFMPEG_PATH': process.env.FFMPEG_PATH,
    'FFPROBE_PATH': process.env.FFPROBE_PATH,
  };

  const missing = Object.entries(required).filter(([key, value]) => !value);
  const missingOptional = Object.entries(optional).filter(([key, value]) => !value);

  if (missing.length > 0) {
    return {
      service: 'Environment Variables',
      status: 'unhealthy',
      message: `Missing required environment variables: ${missing.map(([key]) => key).join(', ')}`,
      details: { missing, missingOptional }
    };
  }

  if (missingOptional.length > 0) {
    return {
      service: 'Environment Variables',
      status: 'warning',
      message: `Missing optional environment variables: ${missingOptional.map(([key]) => key).join(', ')}`,
      details: { missing: [], missingOptional }
    };
  }

  return {
    service: 'Environment Variables',
    status: 'healthy',
    message: 'All environment variables are configured',
    details: { required: Object.keys(required), optional: Object.keys(optional) }
  };
}

/**
 * Check Supabase connection and table availability
 */
export async function checkSupabaseHealth(): Promise<HealthCheckResult> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        service: 'Supabase',
        status: 'unhealthy',
        message: 'Supabase credentials not configured'
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Test connection with a simple query
    const { data, error } = await supabase
      .from('sources')
      .select('count')
      .limit(1);

    if (error) {
      return {
        service: 'Supabase',
        status: 'unhealthy',
        message: `Supabase connection failed: ${error.message}`,
        details: error
      };
    }

    // Check if transcription_progress table exists
    const { error: progressError } = await supabase
      .from('transcription_progress')
      .select('count')
      .limit(1);

    if (progressError) {
      return {
        service: 'Supabase',
        status: 'warning',
        message: 'Supabase connected but transcription_progress table missing. Run migration.',
        details: progressError
      };
    }

    return {
      service: 'Supabase',
      status: 'healthy',
      message: 'Supabase connection and tables verified'
    };
  } catch (error) {
    return {
      service: 'Supabase',
      status: 'unhealthy',
      message: `Supabase health check failed: ${(error as Error).message}`,
      details: error
    };
  }
}

/**
 * Check OpenAI API availability
 */
export async function checkOpenAIHealth(): Promise<HealthCheckResult> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return {
        service: 'OpenAI API',
        status: 'unhealthy',
        message: 'OpenAI API key not configured'
      };
    }

    // Test API with a minimal request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          service: 'OpenAI API',
          status: 'unhealthy',
          message: `OpenAI API check failed: ${response.status} ${response.statusText}`
        };
      }

      const data = await response.json();
      const hasWhisperModels = data.data?.some((model: any) => model.id.includes('whisper'));

      if (!hasWhisperModels) {
        return {
          service: 'OpenAI API',
          status: 'warning',
          message: 'OpenAI API accessible but Whisper models not available'
        };
      }

      return {
        service: 'OpenAI API',
        status: 'healthy',
        message: 'OpenAI API and Whisper models accessible'
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    return {
      service: 'OpenAI API',
      status: 'unhealthy',
      message: `OpenAI API health check failed: ${(error as Error).message}`,
      details: error
    };
  }
}

/**
 * Check FFmpeg availability
 */
export async function checkFFmpegHealth(): Promise<HealthCheckResult> {
  try {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      let resolved = false;
      
      const resolveOnce = (result: HealthCheckResult) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      try {
        const ffmpeg = spawn('ffmpeg', ['-version']);
        let output = '';

        ffmpeg.stdout?.on('data', (data) => {
          output += data.toString();
        });

        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolveOnce({
              service: 'FFmpeg',
              status: 'healthy',
              message: 'FFmpeg is available and functional',
              details: { version: output.split('\n')[0] }
            });
          } else {
            resolveOnce({
              service: 'FFmpeg',
              status: 'warning',
              message: `FFmpeg check returned exit code: ${code}, but may still work`
            });
          }
        });

        ffmpeg.on('error', (error) => {
          resolveOnce({
            service: 'FFmpeg',
            status: 'warning',
            message: `FFmpeg not available in PATH: ${error.message}`,
            details: error
          });
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          try {
            ffmpeg.kill();
          } catch {}
          resolveOnce({
            service: 'FFmpeg',
            status: 'warning',
            message: 'FFmpeg health check timed out'
          });
        }, 5000);
      } catch (spawnError) {
        resolveOnce({
          service: 'FFmpeg',
          status: 'warning',
          message: `FFmpeg spawn failed: ${(spawnError as Error).message}`
        });
      }
    });
  } catch (error) {
    return {
      service: 'FFmpeg',
      status: 'warning',
      message: `FFmpeg health check failed: ${(error as Error).message}`,
      details: error
    };
  }
}

/**
 * Check yt-dlp availability
 */
export async function checkYtDlpHealth(): Promise<HealthCheckResult> {
  try {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const ytdlp = spawn('yt-dlp', ['--version']);
      let output = '';

      ytdlp.stdout.on('data', (data) => {
        output += data.toString();
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          resolve({
            service: 'yt-dlp',
            status: 'healthy',
            message: 'yt-dlp is available and functional',
            details: { version: output.trim() }
          });
        } else {
          resolve({
            service: 'yt-dlp',
            status: 'warning',
            message: `yt-dlp check returned exit code: ${code}, will attempt auto-download`
          });
        }
      });

      ytdlp.on('error', (error) => {
        resolve({
          service: 'yt-dlp',
          status: 'warning',
          message: `yt-dlp not available in PATH: ${error.message}, will attempt auto-download`,
          details: error
        });
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        ytdlp.kill();
        resolve({
          service: 'yt-dlp',
          status: 'warning',
          message: 'yt-dlp health check timed out, will attempt auto-download'
        });
      }, 5000);
    });
  } catch (error) {
    return {
      service: 'yt-dlp',
      status: 'warning',
      message: `yt-dlp health check failed: ${(error as Error).message}, will attempt auto-download`,
      details: error
    };
  }
}

/**
 * Comprehensive system health check
 */
export async function performSystemHealthCheck(): Promise<SystemHealthStatus> {
  console.log('Starting comprehensive system health check...');

  const checks = await Promise.all([
    validateEnvironmentVariables(),
    checkSupabaseHealth(),
    checkOpenAIHealth(),
    checkFFmpegHealth(),
    checkYtDlpHealth()
  ]);

  const hasUnhealthy = checks.some(check => check.status === 'unhealthy');
  const hasWarnings = checks.some(check => check.status === 'warning');

  const overall = hasUnhealthy ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

  const status: SystemHealthStatus = {
    overall,
    checks,
    timestamp: new Date()
  };

  console.log('System health check completed:', {
    overall: status.overall,
    healthy: checks.filter(c => c.status === 'healthy').length,
    warnings: checks.filter(c => c.status === 'warning').length,
    unhealthy: checks.filter(c => c.status === 'unhealthy').length
  });

  return status;
}

/**
 * Check if system is ready for transcription
 */
export async function isSystemReadyForTranscription(): Promise<{
  ready: boolean;
  reason?: string;
  health: SystemHealthStatus;
}> {
  const health = await performSystemHealthCheck();

  if (health.overall === 'unhealthy') {
    const unhealthyServices = health.checks
      .filter(c => c.status === 'unhealthy')
      .map(c => c.service)
      .join(', ');

    return {
      ready: false,
      reason: `Critical services are unavailable: ${unhealthyServices}`,
      health
    };
  }

  return {
    ready: true,
    health
  };
}