import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const results = [];
  
  // Test multiple extraction strategies without proxy first
  const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  
  // Strategy 1: Basic yt-dlp without proxy
  try {
    const { stdout } = await execAsync(
      `yt-dlp --dump-json --no-warnings "${testUrl}" | head -50`,
      { timeout: 20000 }
    );
    const info = JSON.parse(stdout.split('\n')[0]);
    results.push({
      strategy: 'Basic yt-dlp (no proxy)',
      status: 'SUCCESS',
      title: info.title,
      duration: info.duration
    });
  } catch (error) {
    results.push({
      strategy: 'Basic yt-dlp (no proxy)',
      status: 'FAILED',
      error: error instanceof Error ? error.message.substring(0, 150) : 'Unknown'
    });
  }
  
  // Strategy 2: Try with cookies file approach
  try {
    const { stdout } = await execAsync(
      `yt-dlp --dump-json --no-warnings --extractor-args "youtube:skip=dash" "${testUrl}" | head -50`,
      { timeout: 20000 }
    );
    const info = JSON.parse(stdout.split('\n')[0]);
    results.push({
      strategy: 'yt-dlp with skip-dash',
      status: 'SUCCESS',
      title: info.title,
      duration: info.duration
    });
  } catch (error) {
    results.push({
      strategy: 'yt-dlp with skip-dash',
      status: 'FAILED',
      error: error instanceof Error ? error.message.substring(0, 150) : 'Unknown'
    });
  }
  
  // Strategy 3: Try extracting captions only (doesn't need proxy)
  try {
    const { stdout } = await execAsync(
      `yt-dlp --list-subs --no-warnings "${testUrl}"`,
      { timeout: 15000 }
    );
    results.push({
      strategy: 'Caption extraction',
      status: 'SUCCESS',
      captions_available: stdout.includes('vtt') || stdout.includes('srt')
    });
  } catch (error) {
    results.push({
      strategy: 'Caption extraction',
      status: 'FAILED',
      error: error instanceof Error ? error.message.substring(0, 150) : 'Unknown'
    });
  }
  
  // Strategy 4: Test different proxies
  const proxies = [
    'socks5://127.0.0.1:9050', // Tor if available
    'http://127.0.0.1:8080',   // Common local proxy
    '',                        // No proxy
  ];
  
  for (const proxy of proxies) {
    if (!proxy) continue;
    
    try {
      const proxyFlag = proxy ? `--proxy "${proxy}"` : '';
      const { stdout } = await execAsync(
        `yt-dlp ${proxyFlag} --dump-json --no-warnings "${testUrl}" | head -50`,
        { timeout: 15000 }
      );
      const info = JSON.parse(stdout.split('\n')[0]);
      results.push({
        strategy: `Proxy: ${proxy}`,
        status: 'SUCCESS',
        title: info.title
      });
      break; // Stop at first working proxy
    } catch (error) {
      results.push({
        strategy: `Proxy: ${proxy}`,
        status: 'FAILED',
        error: error instanceof Error ? error.message.substring(0, 100) : 'Unknown'
      });
    }
  }
  
  // Check if we can use YouTube API as fallback
  const googleApiKey = process.env.GOOGLE_API_KEY;
  if (googleApiKey) {
    try {
      const videoId = testUrl.split('v=')[1]?.split('&')[0];
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${googleApiKey}&part=snippet,contentDetails`
      );
      const data = await response.json();
      
      if (data.items?.[0]) {
        results.push({
          strategy: 'YouTube API fallback',
          status: 'SUCCESS',
          title: data.items[0].snippet.title,
          can_get_metadata: true
        });
      }
    } catch (error) {
      results.push({
        strategy: 'YouTube API fallback',
        status: 'FAILED',
        error: 'API request failed'
      });
    }
  }
  
  // Summary
  const workingStrategies = results.filter(r => r.status === 'SUCCESS');
  const hasWorkingSolution = workingStrategies.length > 0;
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    test_results: results,
    summary: {
      total_strategies: results.length,
      working_strategies: workingStrategies.length,
      has_solution: hasWorkingSolution,
      recommended_strategy: workingStrategies[0]?.strategy || 'None working'
    },
    diagnosis: hasWorkingSolution 
      ? 'System can extract YouTube videos - transcription should work'
      : 'All extraction methods failed - need to implement alternative approach',
    next_steps: hasWorkingSolution
      ? ['Try transcribing a video', 'Check transcription logs']
      : ['Check network connectivity', 'Verify YouTube is accessible', 'Consider using captions-only mode']
  });
}