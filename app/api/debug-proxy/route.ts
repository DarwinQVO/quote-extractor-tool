import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const proxyFromEnv = process.env.YTDLP_PROXY;
  const fallbackProxy = 'http://brd-customer-hl_16699f5c-zone-residential_proxy1:j24ifit7dkc6@brd.superproxy.io:33335';
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    proxy_configuration: {
      YTDLP_PROXY_ENV: proxyFromEnv || 'NOT SET',
      using_fallback: !proxyFromEnv,
      actual_proxy_used: proxyFromEnv || fallbackProxy,
      proxy_exists: !!proxyFromEnv,
      proxy_length: proxyFromEnv?.length || 0,
      proxy_starts_with: proxyFromEnv ? proxyFromEnv.substring(0, 20) + '...' : 'N/A'
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'local'
    },
    recommendation: !proxyFromEnv ? 
      'Add YTDLP_PROXY to Railway environment variables' : 
      'Proxy is configured correctly'
  });
}