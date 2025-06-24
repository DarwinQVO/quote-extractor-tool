import { NextRequest, NextResponse } from 'next/server';
import { loadTranscript } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { sourceId: string } }
) {
  try {
    const sourceId = params.sourceId;
    
    if (!sourceId) {
      return NextResponse.json({ error: 'Source ID is required' }, { status: 400 });
    }
    
    const transcript = await loadTranscript(sourceId);
    
    if (!transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }
    
    return NextResponse.json(transcript);
  } catch (error) {
    console.error('Error loading transcript:', error);
    return NextResponse.json({ 
      error: 'Failed to load transcript',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}