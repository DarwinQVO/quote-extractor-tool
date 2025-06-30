import { NextRequest } from 'next/server';
import { getProgress } from '@/lib/persistent-progress';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get('id');
  
  if (!sourceId) {
    return new Response('Missing source ID', { status: 400 });
  }
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(async () => {
        try {
          const progressData = await getProgress(sourceId);
          
          if (!progressData) {
            const data = `data: ${JSON.stringify({ 
              progress: 0, 
              status: 'not_found',
              message: 'No transcription in progress'
            })}\n\n`;
            controller.enqueue(encoder.encode(data));
            clearInterval(interval);
            controller.close();
            return;
          }
          
          const data = `data: ${JSON.stringify({ 
            progress: progressData.progress,
            status: progressData.status,
            stage: progressData.stage,
            message: progressData.message,
            startedAt: progressData.startedAt,
            updatedAt: progressData.updatedAt
          })}\n\n`;
          controller.enqueue(encoder.encode(data));
          
          // Close stream when completed or failed
          if (progressData.status === 'completed' || progressData.status === 'error') {
            clearInterval(interval);
            controller.close();
          }
        } catch (error) {
          console.error('Error fetching progress:', error);
          const data = `data: ${JSON.stringify({ 
            progress: 0, 
            status: 'error',
            message: 'Failed to fetch progress'
          })}\n\n`;
          controller.enqueue(encoder.encode(data));
          clearInterval(interval);
          controller.close();
        }
      }, 1000); // Slightly slower polling for better performance
      
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