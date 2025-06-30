import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { OpenAI } from 'openai';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const results = {
    timestamp: new Date().toISOString(),
    checks: [] as any[],
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    }
  };

  // 1. Check OpenAI API Key
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey === 'build-placeholder') {
      throw new Error('OpenAI API key not configured');
    }
    
    // Test OpenAI connection
    const openai = new OpenAI({ apiKey });
    const testResponse = await openai.models.list();
    
    results.checks.push({
      test: 'OpenAI API',
      status: 'PASSED',
      details: {
        key_exists: true,
        key_format: apiKey.startsWith('sk-'),
        models_accessible: true,
        whisper_available: testResponse.data.some(m => m.id.includes('whisper'))
      }
    });
  } catch (error) {
    results.checks.push({
      test: 'OpenAI API',
      status: 'FAILED',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }

  // 2. Check Proxy Configuration
  const proxyFromEnv = process.env.YTDLP_PROXY;
  const fallbackProxy = 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
  
  results.checks.push({
    test: 'Proxy Configuration',
    status: proxyFromEnv ? 'PASSED' : 'WARNING',
    details: {
      YTDLP_PROXY: proxyFromEnv ? 'SET' : 'NOT SET - Using fallback',
      using_fallback: !proxyFromEnv,
      proxy_used: proxyFromEnv || fallbackProxy
    }
  });

  // 3. Check yt-dlp Installation
  try {
    const { stdout: ytdlpVersion } = await execAsync('yt-dlp --version');
    results.checks.push({
      test: 'yt-dlp Installation',
      status: 'PASSED',
      details: {
        installed: true,
        version: ytdlpVersion.trim()
      }
    });
  } catch (error) {
    results.checks.push({
      test: 'yt-dlp Installation',
      status: 'FAILED',
      error: 'yt-dlp not found'
    });
  }

  // 4. Check ffmpeg Installation
  try {
    const { stdout: ffmpegVersion } = await execAsync('ffmpeg -version | head -1');
    results.checks.push({
      test: 'ffmpeg Installation',
      status: 'PASSED',
      details: {
        installed: true,
        version: ffmpegVersion.trim()
      }
    });
  } catch (error) {
    results.checks.push({
      test: 'ffmpeg Installation',
      status: 'FAILED',
      error: 'ffmpeg not found'
    });
  }

  // 5. Test yt-dlp with proxy (simple extraction)
  try {
    const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const proxy = proxyFromEnv || fallbackProxy;
    
    const { stdout } = await execAsync(
      `yt-dlp --proxy "${proxy}" --dump-json --no-warnings "${testUrl}" | head -50`,
      { timeout: 30000 }
    );
    
    const videoInfo = JSON.parse(stdout.split('\n')[0]);
    
    results.checks.push({
      test: 'yt-dlp Proxy Test',
      status: 'PASSED',
      details: {
        video_title: videoInfo.title || 'N/A',
        duration: videoInfo.duration || 'N/A',
        proxy_working: true
      }
    });
  } catch (error) {
    results.checks.push({
      test: 'yt-dlp Proxy Test',
      status: 'FAILED',
      error: error instanceof Error ? error.message.substring(0, 200) : 'Unknown error',
      hint: 'Proxy might be blocked or misconfigured'
    });
  }

  // 6. Check Supabase Connection
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    results.checks.push({
      test: 'Supabase Configuration',
      status: (supabaseUrl && supabaseKey) ? 'PASSED' : 'FAILED',
      details: {
        url_configured: !!supabaseUrl,
        key_configured: !!supabaseKey
      }
    });
  } catch (error) {
    results.checks.push({
      test: 'Supabase Configuration',
      status: 'FAILED',
      error: 'Unable to check Supabase'
    });
  }

  // Calculate summary
  results.summary.total = results.checks.length;
  results.summary.passed = results.checks.filter(c => c.status === 'PASSED').length;
  results.summary.failed = results.checks.filter(c => c.status === 'FAILED').length;

  // Overall diagnosis
  const diagnosis = {
    can_transcribe: results.summary.failed === 0,
    missing_requirements: results.checks
      .filter(c => c.status === 'FAILED')
      .map(c => c.test),
    warnings: results.checks
      .filter(c => c.status === 'WARNING')
      .map(c => c.test),
    recommendation: results.summary.failed > 0 ? 
      'Fix the failed checks before attempting transcription' :
      'System is ready for transcription'
  };

  return NextResponse.json({
    ...results,
    diagnosis
  });
}