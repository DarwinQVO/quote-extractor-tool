export interface YouTubeMetadata {
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  videoId: string;
  description?: string;
  uploadDate?: string; // ISO date format (YYYY-MM-DD)
  uploadDateRaw?: string; // Raw YouTube format (YYYYMMDD)
  viewCount?: number;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

export async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata> {
  const videoId = extractVideoId(url);
  
  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }
  
  try {
    const response = await fetch(`/api/youtube/metadata?videoId=${videoId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch video metadata');
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error);
    throw error;
  }
}