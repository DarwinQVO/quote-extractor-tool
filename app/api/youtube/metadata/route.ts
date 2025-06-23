import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');
  
  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }
  
  try {
    // Using noembed as a simple way to get YouTube metadata without API key
    const noembedResponse = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`);
    
    if (!noembedResponse.ok) {
      throw new Error('Failed to fetch from noembed');
    }
    
    const noembedData = await noembedResponse.json();
    
    if (noembedData.error) {
      throw new Error(noembedData.error);
    }
    
    // Extract duration from thumbnail URL pattern or default to 0
    // YouTube thumbnails sometimes contain duration info, but we'll need proper API for accurate duration
    const durationMatch = noembedData.duration?.match(/(\d+)/);
    const duration = durationMatch ? parseInt(durationMatch[1]) : 0;
    
    return NextResponse.json({
      title: noembedData.title || 'Unknown Title',
      channel: noembedData.author_name || 'Unknown Channel',
      duration: duration,
      thumbnail: noembedData.thumbnail_url || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      videoId: videoId,
    });
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video metadata' },
      { status: 500 }
    );
  }
}