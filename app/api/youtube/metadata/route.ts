import { NextRequest, NextResponse } from 'next/server';
import YTDlpWrap from 'yt-dlp-wrap';
import { YouTubeDLInfo } from '@/lib/youtube-types';

// Initialize yt-dlp-wrap
let ytDlpWrap: YTDlpWrap | null = null;

async function getYTDlpWrap() {
  if (!ytDlpWrap) {
    ytDlpWrap = new YTDlpWrap();
  }
  return ytDlpWrap;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const videoId = searchParams.get('videoId');
  
  if (!videoId) {
    return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
  }
  
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Get real metadata using yt-dlp
    const ytdl = await getYTDlpWrap();
    const info = await ytdl.execPromise([
      url,
      '--dump-json',
      '--no-warnings'
    ]).then(JSON.parse);
    
    const videoInfo = typeof info === 'object' ? info as YouTubeDLInfo : null;
    
    // Parse YouTube date format (YYYYMMDD) to ISO date
    let parsedUploadDate = null;
    if (videoInfo?.upload_date) {
      const dateStr = videoInfo.upload_date;
      if (typeof dateStr === 'string' && dateStr.length === 8) {
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        parsedUploadDate = `${year}-${month}-${day}`;
      }
    }
    
    return NextResponse.json({
      title: videoInfo?.title || 'Unknown Title',
      channel: videoInfo?.uploader || videoInfo?.channel || 'Unknown Channel',
      duration: videoInfo?.duration || 0,
      thumbnail: videoInfo?.thumbnail || `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      videoId: videoId,
      description: videoInfo?.description ? videoInfo.description.substring(0, 200) + '...' : '',
      uploadDate: parsedUploadDate,
      uploadDateRaw: videoInfo?.upload_date || '',
      viewCount: videoInfo?.view_count || 0,
    });
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error);
    
    // Fallback to basic info if youtube-dl fails
    return NextResponse.json({
      title: `Video ${videoId}`,
      channel: 'Unknown Channel',
      duration: 0,
      thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      videoId: videoId,
      description: '',
      uploadDate: '',
      viewCount: 0,
    });
  }
}