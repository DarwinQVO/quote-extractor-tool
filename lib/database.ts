import { prisma } from './prisma'
import { VideoSource, Quote, Transcript } from './types'

// Sources
export async function saveSources(sources: VideoSource[]) {
  try {
    for (const source of sources) {
      await prisma.source.upsert({
        where: { id: source.id },
        update: {
          url: source.url,
          title: source.title,
          channel: source.channel,
          duration: source.duration,
          thumbnail: source.thumbnail,
          description: source.description,
          uploadDate: source.uploadDate,
          viewCount: source.viewCount,
          status: source.status,
          error: source.error,
        },
        create: {
          id: source.id,
          url: source.url,
          title: source.title,
          channel: source.channel,
          duration: source.duration,
          thumbnail: source.thumbnail,
          description: source.description,
          uploadDate: source.uploadDate,
          viewCount: source.viewCount,
          status: source.status,
          error: source.error,
          addedAt: source.addedAt,
        }
      });
    }
    console.log('✅ Sources saved to database')
  } catch (error) {
    console.error('❌ Error saving sources:', error)
  }
}

export async function loadSources(): Promise<VideoSource[]> {
  try {
    const sources = await prisma.source.findMany({
      orderBy: { addedAt: 'desc' }
    });
    
    return sources.map(source => ({
      id: source.id,
      url: source.url,
      title: source.title,
      channel: source.channel,
      duration: source.duration,
      thumbnail: source.thumbnail,
      description: source.description || undefined,
      uploadDate: source.uploadDate || undefined,
      viewCount: source.viewCount || undefined,
      status: source.status as VideoSource['status'],
      error: source.error || undefined,
      addedAt: source.addedAt,
    }));
  } catch (error) {
    console.error('❌ Error loading sources:', error)
    return []
  }
}

export async function saveSource(source: VideoSource) {
  try {
    await prisma.source.upsert({
      where: { id: source.id },
      update: {
        url: source.url,
        title: source.title,
        channel: source.channel,
        duration: source.duration,
        thumbnail: source.thumbnail,
        description: source.description,
        uploadDate: source.uploadDate,
        viewCount: source.viewCount,
        status: source.status,
        error: source.error,
      },
      create: {
        id: source.id,
        url: source.url,
        title: source.title,
        channel: source.channel,
        duration: source.duration,
        thumbnail: source.thumbnail,
        description: source.description,
        uploadDate: source.uploadDate,
        viewCount: source.viewCount,
        status: source.status,
        error: source.error,
        addedAt: source.addedAt,
      }
    });
    console.log('✅ Source saved to database:', source.id)
  } catch (error) {
    console.error('❌ Error saving source:', error)
  }
}

export async function deleteSource(sourceId: string) {
  try {
    // Delete related data first (Prisma will handle cascade)
    await prisma.quote.deleteMany({ where: { sourceId } });
    await prisma.transcript.deleteMany({ where: { sourceId } });
    
    // Delete source
    await prisma.source.delete({ where: { id: sourceId } });
    
    console.log('✅ Source deleted from database:', sourceId)
  } catch (error) {
    console.error('❌ Error deleting source:', error)
  }
}

// Quotes
export async function saveQuotes(quotes: Quote[]) {
  try {
    for (const quote of quotes) {
      await prisma.quote.upsert({
        where: { id: quote.id },
        update: {
          sourceId: quote.sourceId,
          text: quote.text,
          speaker: quote.speaker,
          startTime: quote.startTime,
          endTime: quote.endTime,
          citation: quote.citation,
          timestampLink: quote.timestampLink,
          exported: quote.exported || false,
        },
        create: {
          id: quote.id,
          sourceId: quote.sourceId,
          text: quote.text,
          speaker: quote.speaker,
          startTime: quote.startTime,
          endTime: quote.endTime,
          citation: quote.citation,
          timestampLink: quote.timestampLink,
          exported: quote.exported || false,
          createdAt: quote.createdAt,
        }
      });
    }
    console.log('✅ Quotes saved to database')
  } catch (error) {
    console.error('❌ Error saving quotes:', error)
  }
}

export async function loadQuotes(): Promise<Quote[]> {
  try {
    const quotes = await prisma.quote.findMany({
      orderBy: { createdAt: 'desc' }
    });
    
    return quotes.map(quote => ({
      id: quote.id,
      sourceId: quote.sourceId,
      text: quote.text,
      speaker: quote.speaker,
      startTime: quote.startTime,
      endTime: quote.endTime,
      citation: quote.citation,
      timestampLink: quote.timestampLink,
      exported: quote.exported,
      createdAt: quote.createdAt,
    }));
  } catch (error) {
    console.error('❌ Error loading quotes:', error)
    return []
  }
}

export async function saveQuote(quote: Quote) {
  try {
    await prisma.quote.upsert({
      where: { id: quote.id },
      update: {
        sourceId: quote.sourceId,
        text: quote.text,
        speaker: quote.speaker,
        startTime: quote.startTime,
        endTime: quote.endTime,
        citation: quote.citation,
        timestampLink: quote.timestampLink,
        exported: quote.exported || false,
      },
      create: {
        id: quote.id,
        sourceId: quote.sourceId,
        text: quote.text,
        speaker: quote.speaker,
        startTime: quote.startTime,
        endTime: quote.endTime,
        citation: quote.citation,
        timestampLink: quote.timestampLink,
        exported: quote.exported || false,
        createdAt: quote.createdAt,
      }
    });
    console.log('✅ Quote saved to database:', quote.id)
  } catch (error) {
    console.error('❌ Error saving quote:', error)
  }
}

export async function deleteQuote(quoteId: string) {
  try {
    await prisma.quote.delete({ where: { id: quoteId } });
    console.log('✅ Quote deleted from database:', quoteId)
  } catch (error) {
    console.error('❌ Error deleting quote:', error)
  }
}

// Transcripts
export async function saveTranscript(sourceId: string, transcript: Transcript) {
  try {
    await prisma.transcript.upsert({
      where: { sourceId },
      update: {
        segments: transcript.segments,
        words: transcript.words || [],
        speakers: transcript.speakers || [],
      },
      create: {
        sourceId,
        segments: transcript.segments,
        words: transcript.words || [],
        speakers: transcript.speakers || [],
      }
    });
    console.log('✅ Transcript saved to database:', sourceId)
  } catch (error) {
    console.error('❌ Error saving transcript:', error)
  }
}

export async function loadTranscript(sourceId: string): Promise<Transcript | null> {
  try {
    const transcript = await prisma.transcript.findUnique({
      where: { sourceId }
    });
    
    if (!transcript) return null;
    
    return {
      sourceId: transcript.sourceId,
      segments: transcript.segments as any[] || [],
      words: transcript.words as any[] || [],
      speakers: transcript.speakers as any[] || [],
    };
  } catch (error) {
    console.error('❌ Error loading transcript:', error)
    return null
  }
}

export async function loadAllTranscripts(): Promise<Map<string, Transcript>> {
  try {
    const transcripts = await prisma.transcript.findMany();
    
    const transcriptsMap = new Map<string, Transcript>();
    
    transcripts.forEach(transcript => {
      transcriptsMap.set(transcript.sourceId, {
        sourceId: transcript.sourceId,
        segments: transcript.segments as any[] || [],
        words: transcript.words as any[] || [],
        speakers: transcript.speakers as any[] || [],
      });
    });
    
    return transcriptsMap;
  } catch (error) {
    console.error('❌ Error loading transcripts:', error)
    return new Map()
  }
}