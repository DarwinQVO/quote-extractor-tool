/**
 * Force Memory Storage Mode
 * Bypasses all external dependencies and forces memory-only operation
 */

import { NextRequest, NextResponse } from 'next/server';
import { memoryStorage_ } from '@/lib/memory-storage';

export async function POST(request: NextRequest) {
  try {
    const { action, data } = await request.json();
    
    switch (action) {
      case 'create-test-data':
        // Create test sources
        const testSources = [
          {
            id: 'test-1',
            url: 'https://youtube.com/watch?v=test1',
            title: 'Test Video 1 - Memory Storage Demo',
            channel: 'Test Channel',
            duration: 180,
            thumbnail: 'https://img.youtube.com/vi/test1/maxresdefault.jpg',
            status: 'ready' as const,
            addedAt: new Date()
          },
          {
            id: 'test-2', 
            url: 'https://youtube.com/watch?v=test2',
            title: 'Test Video 2 - Railway Production',
            channel: 'Railway Channel',
            duration: 240,
            thumbnail: 'https://img.youtube.com/vi/test2/maxresdefault.jpg',
            status: 'ready' as const,
            addedAt: new Date()
          }
        ];
        
        for (const source of testSources) {
          await memoryStorage_.sources.create(source);
          
          // Create test transcript
          const transcript = {
            sourceId: source.id,
            segments: [
              {
                id: 1,
                start: 0,
                end: 10,
                text: `This is a test transcript for ${source.title}`,
                speaker: 'Speaker 1'
              },
              {
                id: 2,
                start: 10,
                end: 20,
                text: 'The memory storage system is working correctly without any external dependencies.',
                speaker: 'Speaker 1'
              }
            ],
            words: [],
            speakers: ['Speaker 1']
          };
          
          await memoryStorage_.transcripts.save(transcript);
          
          // Create test quote
          const quote = {
            id: `quote-${source.id}`,
            sourceId: source.id,
            text: `This is a test transcript for ${source.title}`,
            speaker: 'Speaker 1',
            startTime: 0,
            endTime: 10,
            citation: `${source.title} - Speaker 1`,
            timestampLink: `${source.url}&t=0s`,
            exported: false,
            createdAt: new Date()
          };
          
          await memoryStorage_.quotes.create(quote);
        }
        
        return NextResponse.json({
          success: true,
          message: 'Test data created in memory storage',
          stats: memoryStorage_.stats.getSummary()
        });
        
      case 'clear-all':
        memoryStorage_.stats.clear();
        return NextResponse.json({
          success: true,
          message: 'All memory storage cleared'
        });
        
      case 'get-stats':
        return NextResponse.json({
          stats: memoryStorage_.stats.getSummary(),
          sources: await memoryStorage_.sources.findAll(),
          transcripts: await memoryStorage_.transcripts.findAll(),
          quotes: await memoryStorage_.quotes.findAll()
        });
        
      default:
        return NextResponse.json({
          error: 'Invalid action',
          availableActions: ['create-test-data', 'clear-all', 'get-stats']
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Force memory error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Force Memory Storage API',
      memoryOnly: true,
      stats: memoryStorage_.stats.getSummary(),
      usage: {
        'POST /api/force-memory': {
          'create-test-data': 'Creates test sources, transcripts, and quotes',
          'clear-all': 'Clears all memory storage',
          'get-stats': 'Gets current memory storage statistics'
        },
        'GET /api/force-memory': 'Shows this help and current stats'
      }
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}