import { NextResponse } from 'next/server';
import { getEnvDebug, hasEnv, getEnvSafe } from '@/lib/env';

export async function GET() {
  // Initialize environment manager
  const debugInfo = getEnvDebug();
  
  const envInfo = {
    // Core environment info
    NODE_ENV: process.env.NODE_ENV,
    
    // API Keys status
    OPENAI_API_KEY: hasEnv('OPENAI_API_KEY') ? 'CONFIGURED' : 'MISSING',
    OPENAI_KEY_PREVIEW: hasEnv('OPENAI_API_KEY') ? 
      getEnvSafe('OPENAI_API_KEY', '').substring(0, 10) + '...' : 'NOT_SET',
    
    // Supabase configuration
    NEXT_PUBLIC_SUPABASE_URL: getEnvSafe('NEXT_PUBLIC_SUPABASE_URL', 'MISSING'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: hasEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ? 
      'CONFIGURED (' + getEnvSafe('NEXT_PUBLIC_SUPABASE_ANON_KEY', '').length + ' chars)' : 'MISSING',
    
    // Database
    DATABASE_URL: getEnvSafe('DATABASE_URL', 'file:./dev.db'),
    
    // Railway specific
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'NOT_SET',
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || 'NOT_SET',
    
    // Environment manager debug info
    envManagerDebug: debugInfo,
    
    // All environment variable keys (for debugging)
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('SUPABASE') || 
      key.includes('OPENAI') || 
      key.startsWith('NEXT_PUBLIC') ||
      key.includes('RAILWAY')
    ),
    
    // Timestamp
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(envInfo, {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    }
  });
}