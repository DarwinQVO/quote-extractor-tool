/**
 * Force Direct Supabase Connection - Bypass all checks
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();
    
    console.log('🔥 FORCING DIRECT SUPABASE CONNECTION - NO FALLBACKS');
    
    if (action === 'test-insert') {
      // Force direct insert to Supabase
      const testSource = {
        id: `force-test-${Date.now()}`,
        url: 'https://youtube.com/watch?v=force-test',
        title: 'FORCED Supabase Connection Test',
        channel: 'Force Test Channel',
        duration: 123,
        thumbnail: 'https://test.jpg',
        status: 'ready',
        added_at: new Date().toISOString()
      };

      console.log('🚀 Inserting directly to Supabase sources table...');
      
      const { data, error } = await supabase
        .from('sources')
        .insert(testSource)
        .select()
        .single();

      if (error) {
        console.error('❌ Direct Supabase insert failed:', error);
        return NextResponse.json({
          success: false,
          error: error.message,
          code: error.code,
          details: error.details
        }, { status: 500 });
      }

      console.log('✅ SUCCESS: Direct Supabase insert worked!');
      
      return NextResponse.json({
        success: true,
        message: 'Successfully inserted directly into Supabase',
        data: data,
        proof: 'This data came from Supabase, not memory'
      });
    }
    
    if (action === 'load-real-data') {
      console.log('🔍 Loading real data directly from Supabase...');
      
      const { data: sources, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: quotes, error: quotesError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (sourcesError || quotesError) {
        return NextResponse.json({
          success: false,
          errors: {
            sources: sourcesError?.message,
            quotes: quotesError?.message
          }
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        message: 'Real data loaded directly from Supabase',
        data: {
          sources_count: sources?.length || 0,
          quotes_count: quotes?.length || 0,
          sources: sources?.map(s => ({
            id: s.id,
            title: s.title,
            created_at: s.created_at
          })) || [],
          quotes: quotes?.map(q => ({
            id: q.id,
            text: q.text?.substring(0, 50) + '...',
            created_at: q.created_at
          })) || []
        },
        proof: 'This is your REAL data from Supabase'
      });
    }

    return NextResponse.json({
      error: 'Invalid action',
      available_actions: ['test-insert', 'load-real-data']
    }, { status: 400 });

  } catch (error) {
    console.error('Force Supabase error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to force Supabase connection'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Force Supabase Connection API',
    description: 'Bypasses all checks and connects directly to Supabase',
    usage: {
      'POST /api/force-supabase': {
        'test-insert': 'Force insert test data directly to Supabase',
        'load-real-data': 'Load your real existing data from Supabase'
      }
    },
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      supabase_url_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabase_key_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    }
  });
}