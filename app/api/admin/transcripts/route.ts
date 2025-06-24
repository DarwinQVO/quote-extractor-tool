import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    console.log('🔍 Checking Supabase transcripts...');
    
    // Get all transcripts from Supabase
    const { data: transcripts, error } = await supabase
      .from('transcripts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    // Get sources for additional info
    const { data: sources, error: sourcesError } = await supabase
      .from('sources')
      .select('id, title, channel');
    
    if (sourcesError) throw sourcesError;
    
    const sourcesMap = new Map(sources?.map(s => [s.id, s]) || []);
    
    const transcriptSummary = (transcripts || []).map(transcript => {
      const source = sourcesMap.get(transcript.source_id);
      const segments = transcript.segments || [];
      const speakers = transcript.speakers || [];
      
      return {
        id: transcript.id,
        sourceId: transcript.source_id,
        sourceTitle: source?.title || 'Unknown',
        sourceChannel: source?.channel || 'Unknown',
        createdAt: transcript.created_at,
        updatedAt: transcript.updated_at,
        segmentsCount: segments.length,
        wordsCount: (transcript.words || []).length,
        speakersCount: speakers.length,
        speakers: speakers.map((s: any) => s.originalName || s.customName || 'Unknown'),
        firstSegment: segments[0]?.text?.substring(0, 100) + '...' || 'No segments',
      };
    });
    
    console.log(`✅ Found ${transcripts?.length || 0} transcripts in Supabase`);
    
    return NextResponse.json({
      success: true,
      count: transcripts?.length || 0,
      transcripts: transcriptSummary,
    });
    
  } catch (error) {
    console.error('❌ Failed to get transcripts:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transcriptId = searchParams.get('id');
    const sourceId = searchParams.get('sourceId');
    
    if (!transcriptId && !sourceId) {
      return NextResponse.json({
        error: 'Either transcriptId or sourceId is required'
      }, { status: 400 });
    }
    
    console.log(`🗑️ Deleting transcript: ${transcriptId || sourceId}`);
    
    let result;
    if (transcriptId) {
      result = await supabase
        .from('transcripts')
        .delete()
        .eq('id', transcriptId)
        .select();
    } else {
      result = await supabase
        .from('transcripts')
        .delete()
        .eq('source_id', sourceId!)
        .select();
    }
    
    if (result.error) throw result.error;
    
    const deleted = result.data?.[0];
    
    console.log(`✅ Deleted transcript: ${deleted?.id || 'unknown'}`);
    
    return NextResponse.json({
      success: true,
      message: `Transcript deleted successfully`,
      deletedId: deleted?.id,
      deletedSourceId: deleted?.source_id,
    });
    
  } catch (error) {
    console.error('❌ Failed to delete transcript:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}