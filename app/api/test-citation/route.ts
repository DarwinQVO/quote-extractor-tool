import { NextResponse } from 'next/server';
import { buildCitation } from '@/lib/citations';

export async function GET() {
  try {
    // Test the citation building function
    const mockSource = {
      id: 'test-123',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Test Video',
      channel: 'Test Channel',
      duration: 300,
      thumbnail: 'test.jpg',
      status: 'ready' as const,
      addedAt: new Date('2023-07-15'), // July 15, 2023
    };

    const mockSegment = {
      speaker: 'Sam',
      start: 45.5,
      end: 60.2,
      text: 'This is a test quote from the video'
    };

    const citation = buildCitation(mockSource, mockSegment);

    return NextResponse.json({
      success: true,
      test: {
        citationText: citation.text,
        link: citation.link,
        markdown: citation.markdown,
      },
      expectedFormat: 'Sam (Jul 2023)',
      actualFormat: citation.text,
      isCorrect: citation.text === 'Sam (Jul 2023)',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}