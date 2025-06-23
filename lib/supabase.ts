import { createClient } from '@supabase/supabase-js'

// Lazy initialization to avoid build-time errors
let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Debug logging to see what Railway is providing
    console.log('🔍 Environment Variables Debug:', {
      NODE_ENV: process.env.NODE_ENV,
      supabaseUrlExists: !!supabaseUrl,
      supabaseUrl: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'MISSING',
      supabaseKeyExists: !!supabaseAnonKey,
      supabaseKeyLength: supabaseAnonKey?.length || 0,
      allEnvKeys: Object.keys(process.env).filter(key => key.includes('SUPABASE')),
    });
    
    // Validate URLs during runtime only
    if (!supabaseUrl || supabaseUrl === 'build-placeholder' || supabaseUrl.trim() === '') {
      throw new Error(`NEXT_PUBLIC_SUPABASE_URL environment variable is required. Current value: "${supabaseUrl}"`);
    }
    
    if (!supabaseAnonKey || supabaseAnonKey === 'build-placeholder' || supabaseAnonKey.trim() === '') {
      throw new Error(`NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is required. Current value: "${supabaseAnonKey ? supabaseAnonKey.substring(0, 10) + '...' : 'MISSING'}"`);
    }
    
    // Only log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🔧 Supabase Config:', {
        url: supabaseUrl,
        keyLength: supabaseAnonKey?.length || 0,
        keyExists: !!supabaseAnonKey
      });
    }
    
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    console.log('✅ Supabase client created successfully');
  }
  
  return supabaseClient;
}

export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    const client = getSupabaseClient();
    return client[prop as keyof typeof client];
  }
});

// Database types
export interface DatabaseSource {
  id: string
  url: string
  title: string
  channel: string
  duration: number
  thumbnail: string
  description?: string
  upload_date?: string
  view_count?: number
  status: 'fetching-metadata' | 'pending' | 'transcribing' | 'ready' | 'error'
  error?: string
  added_at: string
  created_at: string
  updated_at: string
}

export interface DatabaseQuote {
  id: string
  source_id: string
  text: string
  speaker: string
  start_time: number
  end_time: number
  citation: string
  timestamp_link: string
  exported: boolean
  created_at: string
  updated_at: string
}

export interface DatabaseTranscript {
  id: string
  source_id: string
  segments: unknown[]
  words: unknown[]
  speakers: unknown[]
  created_at: string
  updated_at: string
}

import { VideoSource, Quote } from './types';

// Helper functions for data transformation
export const transformSourceFromDB = (dbSource: DatabaseSource) => ({
  id: dbSource.id,
  url: dbSource.url,
  title: dbSource.title,
  channel: dbSource.channel,
  duration: dbSource.duration,
  thumbnail: dbSource.thumbnail,
  description: dbSource.description,
  uploadDate: dbSource.upload_date ? new Date(dbSource.upload_date) : undefined,
  viewCount: dbSource.view_count,
  status: dbSource.status,
  error: dbSource.error,
  addedAt: new Date(dbSource.added_at),
})

export const transformSourceToDB = (source: VideoSource) => ({
  id: source.id,
  url: source.url,
  title: source.title,
  channel: source.channel,
  duration: source.duration,
  thumbnail: source.thumbnail,
  description: source.description,
  upload_date: source.uploadDate?.toISOString(),
  view_count: source.viewCount,
  status: source.status,
  error: source.error,
  added_at: source.addedAt.toISOString(),
})

export const transformQuoteFromDB = (dbQuote: DatabaseQuote) => ({
  id: dbQuote.id,
  sourceId: dbQuote.source_id,
  text: dbQuote.text,
  speaker: dbQuote.speaker,
  startTime: dbQuote.start_time,
  endTime: dbQuote.end_time,
  citation: dbQuote.citation,
  timestampLink: dbQuote.timestamp_link,
  exported: dbQuote.exported,
  createdAt: new Date(dbQuote.created_at),
})

export const transformQuoteToDB = (quote: Quote) => ({
  id: quote.id,
  source_id: quote.sourceId,
  text: quote.text,
  speaker: quote.speaker,
  start_time: quote.startTime,
  end_time: quote.endTime,
  citation: quote.citation,
  timestamp_link: quote.timestampLink,
  exported: quote.exported || false,
})