import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { action, sourceIds } = await request.json();
    
    if (action === 'delete-selected' && Array.isArray(sourceIds)) {
      // Delete selected sources and their related data
      for (const sourceId of sourceIds) {
        await supabase.from('quotes').delete().eq('source_id', sourceId);
        await supabase.from('transcripts').delete().eq('source_id', sourceId);
        await supabase.from('sources').delete().eq('id', sourceId);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${sourceIds.length} sources and their related data` 
      });
    }
    
    if (action === 'delete-all-failed') {
      // Get all sources with error status
      const { data: failedSources, error } = await supabase
        .from('sources')
        .select('id')
        .eq('status', 'error');
      
      if (error) throw error;
      
      for (const source of failedSources || []) {
        await supabase.from('quotes').delete().eq('source_id', source.id);
        await supabase.from('transcripts').delete().eq('source_id', source.id);
        await supabase.from('sources').delete().eq('id', source.id);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${failedSources?.length || 0} failed transcripts` 
      });
    }
    
    if (action === 'delete-all-test') {
      // Delete sources that look like test data
      const { data: sources, error } = await supabase
        .from('sources')
        .select('id, title, channel, duration');
      
      if (error) throw error;
      
      const testSources = (sources || []).filter(source => 
        source.title.toLowerCase().includes('test') ||
        source.title === 'Loading...' ||
        source.channel === '' ||
        source.duration <= 60
      );
      
      for (const source of testSources) {
        await supabase.from('quotes').delete().eq('source_id', source.id);
        await supabase.from('transcripts').delete().eq('source_id', source.id);
        await supabase.from('sources').delete().eq('id', source.id);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Deleted ${testSources.length} test transcripts` 
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in bulk cleanup:', error);
    return NextResponse.json({ error: 'Cleanup failed' }, { status: 500 });
  }
}