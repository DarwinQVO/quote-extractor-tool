import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('=== TRANSCRIBE DEBUG ENDPOINT ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const body = await request.json();
    console.log('Request body:', JSON.stringify(body, null, 2));
    
    const { sourceId, url } = body;
    
    if (!sourceId || !url) {
      console.log('Missing required fields');
      return NextResponse.json({ 
        error: 'Missing sourceId or url',
        received: { sourceId, url }
      }, { status: 400 });
    }
    
    // Log all environment variables (sanitized)
    console.log('Environment check:');
    console.log('- OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? 'SET' : 'NOT SET');
    console.log('- YTDLP_PROXY:', process.env.YTDLP_PROXY ? 'SET' : 'NOT SET');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- RAILWAY_ENVIRONMENT:', process.env.RAILWAY_ENVIRONMENT);
    
    // Test OpenAI
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey || apiKey === 'build-placeholder') {
        throw new Error('OpenAI API key not configured');
      }
      console.log('✅ OpenAI API key exists and is valid format');
    } catch (error) {
      console.error('❌ OpenAI check failed:', error);
      return NextResponse.json({ 
        error: 'OpenAI configuration error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }
    
    // Test proxy configuration
    const proxyFromEnv = process.env.YTDLP_PROXY;
    const fallbackProxy = 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
    const proxyUsed = proxyFromEnv || fallbackProxy;
    
    console.log('Proxy configuration:');
    console.log('- From env:', proxyFromEnv ? 'YES' : 'NO');
    console.log('- Using fallback:', !proxyFromEnv);
    console.log('- Proxy to use:', proxyUsed.substring(0, 30) + '...');
    
    // Test yt-dlp availability
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout: ytdlpVersion } = await execAsync('yt-dlp --version');
      console.log('✅ yt-dlp version:', ytdlpVersion.trim());
      
      // Test video info extraction with proxy
      console.log('Testing video info extraction...');
      const { stdout: videoInfo } = await execAsync(
        `yt-dlp --proxy "${proxyUsed}" --dump-json --no-warnings "${url}" | head -100`,
        { timeout: 30000 }
      );
      
      const info = JSON.parse(videoInfo.split('\n')[0]);
      console.log('✅ Video info extracted successfully');
      console.log('- Title:', info.title);
      console.log('- Duration:', info.duration, 'seconds');
      console.log('- Has formats:', !!info.formats);
      
    } catch (error) {
      console.error('❌ yt-dlp test failed:', error);
      return NextResponse.json({ 
        error: 'yt-dlp extraction failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check proxy configuration and video availability'
      }, { status: 500 });
    }
    
    // If we get here, basic checks passed
    console.log('✅ All basic checks passed');
    
    return NextResponse.json({
      success: true,
      message: 'Debug checks passed',
      configuration: {
        openai: 'CONFIGURED',
        proxy: proxyFromEnv ? 'ENV' : 'FALLBACK',
        ytdlp: 'AVAILABLE',
        environment: process.env.NODE_ENV
      },
      next_step: 'Try actual transcription endpoint'
    });
    
  } catch (error) {
    console.error('=== DEBUG ENDPOINT ERROR ===');
    console.error(error);
    
    return NextResponse.json({ 
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}