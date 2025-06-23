import { NextRequest, NextResponse } from 'next/server';
import ytdl from 'ytdl-core';
import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';
import { cleanSegments, performBasicDiarization } from '@/lib/cleanTranscript';
import { Segment } from '@/lib/types';
import fs from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store progress for SSE
const progressStore = new Map<string, number>();

export async function POST(request: NextRequest) {
  const { sourceId, url } = await request.json();
  
  if (!sourceId || !url) {
    return NextResponse.json({ error: 'Missing sourceId or url' }, { status: 400 });
  }
  
  try {
    // Check if transcript already exists and is recent
    const existingTranscript = await prisma.transcript.findUnique({
      where: { sourceId },
      include: { segments: true },
    });
    
    if (existingTranscript) {
      const hoursSinceUpdate = (Date.now() - existingTranscript.updatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUpdate < 24) {
        // Return cached transcript
        const segments: Segment[] = existingTranscript.segments.map(s => ({
          speaker: s.speaker,
          start: s.start,
          end: s.end,
          text: s.text,
        }));
        
        return NextResponse.json({ segments, cached: true });
      }
    }
    
    // Update progress
    progressStore.set(sourceId, 10);
    
    // Download audio from YouTube
    const tempDir = tmpdir();
    const audioPath = path.join(tempDir, `${sourceId}.webm`);
    
    const info = await ytdl.getInfo(url);
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'lowestaudio',
      filter: 'audioonly' 
    });
    
    progressStore.set(sourceId, 20);
    
    const audioStream = ytdl(url, { format });
    const writeStream = createWriteStream(audioPath);
    
    await pipeline(audioStream, writeStream);
    
    progressStore.set(sourceId, 50);
    
    // Transcribe with Whisper
    const audioFile = createReadStream(audioPath);
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    });
    
    progressStore.set(sourceId, 80);
    
    // Process segments
    let segments: Segment[] = [];
    
    if (transcription.segments) {
      segments = transcription.segments.map((seg: any) => ({
        speaker: 'Speaker 1', // Whisper doesn't provide speaker diarization
        start: seg.start,
        end: seg.end,
        text: seg.text,
      }));
    }
    
    // Clean and diarize
    segments = cleanSegments(segments);
    segments = performBasicDiarization(segments);
    
    progressStore.set(sourceId, 90);
    
    // Save to database
    if (existingTranscript) {
      // Delete old segments
      await prisma.segment.deleteMany({
        where: { transcriptId: existingTranscript.id },
      });
      
      // Update transcript
      await prisma.transcript.update({
        where: { id: existingTranscript.id },
        data: {
          segments: {
            create: segments.map(seg => ({
              start: seg.start,
              end: seg.end,
              speaker: seg.speaker,
              text: seg.text,
            })),
          },
        },
      });
    } else {
      // Create new transcript
      await prisma.transcript.create({
        data: {
          sourceId,
          segments: {
            create: segments.map(seg => ({
              start: seg.start,
              end: seg.end,
              speaker: seg.speaker,
              text: seg.text,
            })),
          },
        },
      });
    }
    
    // Clean up temp file
    await fs.unlink(audioPath).catch(() => {});
    
    progressStore.set(sourceId, 100);
    
    // Clean up progress after a delay
    setTimeout(() => progressStore.delete(sourceId), 5000);
    
    return NextResponse.json({ segments });
  } catch (error) {
    console.error('Transcription error:', error);
    progressStore.delete(sourceId);
    
    return NextResponse.json(
      { error: 'Transcription failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Export progress getter for SSE endpoint
export function getProgress(sourceId: string): number {
  return progressStore.get(sourceId) || 0;
}