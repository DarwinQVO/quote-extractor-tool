import { NextResponse } from 'next/server';

export async function GET() {
  const envInfo = {
    // Core environment info
    NODE_ENV: process.env.NODE_ENV,
    
    // Raw environment variables (what Railway actually provides)
    RAW_OPENAI_API_KEY: process.env.OPENAI_API_KEY || 'UNDEFINED',
    RAW_NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED',
    RAW_NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'UNDEFINED',
    
    // Validation status
    OPENAI_VALID: !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.startsWith('sk-')),
    SUPABASE_URL_VALID: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_URL.includes('supabase.co')),
    SUPABASE_KEY_VALID: !!(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20),
    
    // Database
    DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
    
    // Railway specific
    RAILWAY_ENVIRONMENT: process.env.RAILWAY_ENVIRONMENT || 'NOT_SET',
    RAILWAY_PROJECT_ID: process.env.RAILWAY_PROJECT_ID || 'NOT_SET',
    
    // All environment variable keys (for debugging)
    allEnvKeys: Object.keys(process.env).filter(key => 
      key.includes('SUPABASE') || 
      key.includes('OPENAI') || 
      key.startsWith('NEXT_PUBLIC') ||
      key.includes('RAILWAY')
    ),
    
    // Timestamp
    timestamp: new Date().toISOString(),
    
    // What Railway is giving us
    allVariables: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => 
        key.includes('SUPABASE') || 
        key.includes('OPENAI') || 
        key.startsWith('NEXT_PUBLIC') ||
        key.includes('RAILWAY')
      )
    )
  };

  return NextResponse.json(envInfo, {
    headers: {
      'Cache-Control': 'no-store, must-revalidate',
    }
  });
}