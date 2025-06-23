import { NextRequest } from 'next/server';
import { getProgress } from '../route';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get('id');
  
  if (!sourceId) {
    return new Response('Missing source ID', { status: 400 });
  }
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        const progress = getProgress(sourceId);
        
        const data = `data: ${JSON.stringify({ progress })}\n\n`;
        controller.enqueue(encoder.encode(data));
        
        if (progress === 100 || progress === 0) {
          clearInterval(interval);
          controller.close();
        }
      }, 750);
      
      // Clean up on client disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}