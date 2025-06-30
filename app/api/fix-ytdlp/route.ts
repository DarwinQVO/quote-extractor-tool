/**
 * Fix yt-dlp Download Issues in Railway
 */

import { NextRequest, NextResponse } from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';

// Get proxy configuration
function getBrightDataProxy(): string {
  const envProxy = process.env.YTDLP_PROXY;
  const fallbackProxy = 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
  return envProxy || fallbackProxy;
}

export async function POST(request: NextRequest) {
  try {
    const { videoId } = await request.json();
    
    if (!videoId) {
      return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
    }

    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const proxyUrl = getBrightDataProxy();
    
    console.log('🔧 Testing yt-dlp with enhanced configuration...');
    
    const ytdl = new YTDlpWrap();
    
    // Test with aggressive anti-detection
    const result = await ytdl.execPromise([
      url,
      '--dump-json',
      '--no-warnings',
      '--proxy', proxyUrl,
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      '--add-header', 'Accept-Language:en-US,en;q=0.9',
      '--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      '--add-header', 'Accept-Encoding:gzip, deflate, br',
      '--add-header', 'DNT:1',
      '--add-header', 'Connection:keep-alive',
      '--add-header', 'Upgrade-Insecure-Requests:1',
      '--extractor-args', 'youtube:player_client=web,tv,android',
      '--cookies-from-browser', 'chrome',
      '--sleep-interval', '1',
      '--max-sleep-interval', '5'
    ]).then(JSON.parse);

    return NextResponse.json({
      success: true,
      message: 'yt-dlp working correctly',
      videoInfo: {
        title: result.title,
        duration: result.duration,
        formats_available: result.formats?.length || 0
      },
      proxy_used: proxyUrl.replace(/:[^:@]+@/, ':***@')
    });

  } catch (error) {
    console.error('yt-dlp test failed:', error);
    
    // Try alternative approach
    try {
      const { videoId } = await request.json();
      const url = `https://www.youtube.com/watch?v=${videoId}`;
      
      const ytdl = new YTDlpWrap();
      
      // Minimal approach
      const result = await ytdl.execPromise([
        url,
        '--dump-json',
        '--no-warnings',
        '--extractor-args', 'youtube:player_client=web'
      ]).then(JSON.parse);

      return NextResponse.json({
        success: true,
        message: 'yt-dlp working with minimal config',
        videoInfo: {
          title: result.title,
          duration: result.duration
        },
        note: 'Using fallback configuration'
      });

    } catch (fallbackError) {
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallback_error: fallbackError instanceof Error ? fallbackError.message : 'Unknown fallback error',
        suggestion: 'YouTube may be blocking requests. Check proxy configuration.'
      }, { status: 500 });
    }
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'yt-dlp Fix API',
    usage: 'POST with {"videoId": "dQw4w9WgXcQ"} to test video download',
    proxy_configured: !!process.env.YTDLP_PROXY,
    current_proxy: process.env.YTDLP_PROXY ? 
      process.env.YTDLP_PROXY.replace(/:[^:@]+@/, ':***@') : 
      'Using fallback proxy'
  });
}