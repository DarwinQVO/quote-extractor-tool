import { NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'MISSING',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'EXISTS' : 'MISSING',
    // Show all environment variables that contain SUPABASE
    allSupabaseKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
    // Show all NEXT_PUBLIC variables
    allNextPublicKeys: Object.keys(process.env).filter(key => key.startsWith('NEXT_PUBLIC')),
    // Railway specific
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'NOT_SET',
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || 'NOT_SET',
  };

  return NextResponse.json(envInfo);
}