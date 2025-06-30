/**
 * Check Database Data - Verify what's actually in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking actual database data...');

    // Check sources table
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Check quotes table  
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Check transcripts table
    const { data: transcripts, error: transcriptsError } = await supabase
      .from('transcripts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    // Count records
    const { count: sourcesCount } = await supabase
      .from('sources')
      .select('*', { count: 'exact', head: true });

    const { count: quotesCount } = await supabase
      .from('quotes')
      .select('*', { count: 'exact', head: true });

    const { count: transcriptsCount } = await supabase
      .from('transcripts')
      .select('*', { count: 'exact', head: true });

    return NextResponse.json({
      success: true,
      database_connected: true,
      counts: {
        sources: sourcesCount,
        quotes: quotesCount,
        transcripts: transcriptsCount
      },
      sample_data: {
        sources: sources?.slice(0, 3).map(s => ({
          id: s.id,
          title: s.title,
          status: s.status,
          created_at: s.created_at
        })) || [],
        quotes: quotes?.slice(0, 3).map(q => ({
          id: q.id,
          text: q.text?.substring(0, 50) + '...',
          speaker: q.speaker,
          created_at: q.created_at
        })) || [],
        transcripts: transcripts?.slice(0, 3).map(t => ({
          id: t.id,
          source_id: t.source_id,
          segments_count: t.segments?.length || 0,
          created_at: t.created_at
        })) || []
      },
      errors: {
        sources: sourcesError?.message || null,
        quotes: quotesError?.message || null,
        transcripts: transcriptsError?.message || null
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Database check error:', error);
    
    return NextResponse.json({
      success: false,
      database_connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to connect to database'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    if (action === 'force-supabase-test') {
      // Force test by creating a test record
      const testSource = {
        id: `test-${Date.now()}`,
        url: 'https://youtube.com/watch?v=test',
        title: 'Database Connection Test',
        channel: 'Test Channel',
        duration: 100,
        thumbnail: 'https://test.jpg',
        status: 'ready',
        added_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('sources')
        .insert(testSource)
        .select()
        .single();

      if (error) {
        return NextResponse.json({
          success: false,
          error: error.message,
          code: error.code
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully inserted test record into Supabase',
        test_record: data
      });
    }

    return NextResponse.json({
      error: 'Invalid action',
      available_actions: ['force-supabase-test']
    }, { status: 400 });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}