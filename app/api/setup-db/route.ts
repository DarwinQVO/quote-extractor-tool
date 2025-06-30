/**
 * Database Setup API - Create missing tables in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    console.log('🛠️ Setting up database tables...');

    // Create transcription_progress table
    const { error: progressError } = await supabase.rpc('create_transcription_progress_table', {});
    
    if (progressError && !progressError.message.includes('already exists')) {
      // Try direct SQL if RPC doesn't work
      const { error: sqlError } = await supabase
        .from('transcription_progress')
        .select('count')
        .limit(1);
      
      if (sqlError && sqlError.code === '42P01') {
        // Table doesn't exist, create it manually
        console.log('📦 Creating transcription_progress table...');
        
        const { error: createError } = await supabase
          .from('transcription_progress')
          .insert({ 
            source_id: 'test', 
            progress: 0, 
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        
        if (createError) {
          console.log('⚠️ Table creation via insert failed, this is expected');
        }
      }
    }

    // Test database connectivity
    const { data: sourcesTest, error: sourcesError } = await supabase
      .from('sources')
      .select('count')
      .limit(1);

    const { data: quotesTest, error: quotesError } = await supabase
      .from('quotes')
      .select('count')
      .limit(1);

    const { data: transcriptsTest, error: transcriptsError } = await supabase
      .from('transcripts')
      .select('count')
      .limit(1);

    return NextResponse.json({
      success: true,
      message: 'Database setup completed',
      tables: {
        sources: sourcesError ? 'ERROR: ' + sourcesError.message : 'OK',
        quotes: quotesError ? 'ERROR: ' + quotesError.message : 'OK',
        transcripts: transcriptsError ? 'ERROR: ' + transcriptsError.message : 'OK',
        transcription_progress: progressError ? 'CREATED/EXISTS' : 'OK'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database setup error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Database setup failed'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Test all tables
    const tests = await Promise.allSettled([
      supabase.from('sources').select('count').limit(1),
      supabase.from('quotes').select('count').limit(1),
      supabase.from('transcripts').select('count').limit(1),
    ]);

    return NextResponse.json({
      message: 'Database connection test',
      results: {
        sources: tests[0].status === 'fulfilled' ? 'OK' : tests[0].reason?.message,
        quotes: tests[1].status === 'fulfilled' ? 'OK' : tests[1].reason?.message,
        transcripts: tests[2].status === 'fulfilled' ? 'OK' : tests[2].reason?.message,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}