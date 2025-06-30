import { supabase, transformSourceFromDB, transformSourceToDB, transformQuoteFromDB, transformQuoteToDB, DatabaseSource, DatabaseQuote } from './supabase'
import { VideoSource, Quote, Transcript } from './types'
import { memoryStorage_ } from './memory-storage'

// Check if Supabase is available
function isSupabaseAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const available = !!(url && key && url !== 'build-placeholder' && key !== 'build-placeholder');
  
  // Force Supabase usage in production if credentials are available
  if (available && process.env.NODE_ENV === 'production') {
    console.log('🔄 Production mode: forcing Supabase connection');
    return true;
  }
  
  return available;
}

// Sources
export async function saveSources(sources: VideoSource[]) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for sources');
    for (const source of sources) {
      await memoryStorage_.sources.create(source);
    }
    return;
  }

  try {
    const dbSources = sources.map(transformSourceToDB)
    
    const { error } = await supabase
      .from('sources')
      .upsert(dbSources, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
    
    if (error) throw error
    console.log('✅ Sources saved to Supabase')
  } catch (error) {
    console.error('❌ Error saving sources, falling back to memory:', error)
    for (const source of sources) {
      await memoryStorage_.sources.create(source);
    }
  }
}

export async function loadSources(): Promise<VideoSource[]> {
  if (!isSupabaseAvailable()) {
    console.log('💾 Loading sources from memory storage');
    return await memoryStorage_.sources.findAll();
  }

  try {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return data?.map(item => transformSourceFromDB(item as unknown as DatabaseSource)) || []
  } catch (error) {
    console.error('❌ Error loading sources, falling back to memory:', error)
    return await memoryStorage_.sources.findAll();
  }
}

export async function updateSource(sourceId: string, updates: Partial<VideoSource>) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for source update');
    return await memoryStorage_.sources.update(sourceId, updates);
  }

  try {
    const existing = await memoryStorage_.sources.findById(sourceId);
    if (!existing) return null;
    
    const updated = { ...existing, ...updates };
    const dbSource = transformSourceToDB(updated);
    
    const { error } = await supabase
      .from('sources')
      .update(dbSource)
      .eq('id', sourceId);
    
    if (error) throw error;
    console.log('✅ Source updated in Supabase:', sourceId);
    return updated;
  } catch (error) {
    console.error('❌ Error updating source, falling back to memory:', error);
    return await memoryStorage_.sources.update(sourceId, updates);
  }
}

export async function saveSource(source: VideoSource) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for source');
    await memoryStorage_.sources.create(source);
    return;
  }

  try {
    const dbSource = transformSourceToDB(source)
    
    const { error } = await supabase
      .from('sources')
      .upsert(dbSource, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
    
    if (error) throw error
    console.log('✅ Source saved to Supabase:', source.id)
  } catch (error) {
    console.error('❌ Error saving source, falling back to memory:', error)
    await memoryStorage_.sources.create(source);
  }
}

export async function deleteSource(sourceId: string) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for deletion');
    await memoryStorage_.quotes.deleteBySourceId(sourceId);
    await memoryStorage_.transcripts.delete(sourceId);
    await memoryStorage_.sources.delete(sourceId);
    return;
  }

  try {
    // Delete related data first
    await supabase.from('quotes').delete().eq('source_id', sourceId)
    await supabase.from('transcripts').delete().eq('source_id', sourceId)
    
    // Delete source
    const { error } = await supabase
      .from('sources')
      .delete()
      .eq('id', sourceId)
    
    if (error) throw error
    console.log('✅ Source deleted from Supabase:', sourceId)
  } catch (error) {
    console.error('❌ Error deleting source, falling back to memory:', error)
    await memoryStorage_.quotes.deleteBySourceId(sourceId);
    await memoryStorage_.transcripts.delete(sourceId);
    await memoryStorage_.sources.delete(sourceId);
  }
}

// Quotes
export async function saveQuotes(quotes: Quote[]) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for quotes');
    for (const quote of quotes) {
      await memoryStorage_.quotes.create(quote);
    }
    return;
  }

  try {
    const dbQuotes = quotes.map(transformQuoteToDB)
    
    const { error } = await supabase
      .from('quotes')
      .upsert(dbQuotes, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
    
    if (error) throw error
    console.log('✅ Quotes saved to Supabase')
  } catch (error) {
    console.error('❌ Error saving quotes, falling back to memory:', error)
    for (const quote of quotes) {
      await memoryStorage_.quotes.create(quote);
    }
  }
}

export async function loadQuotes(): Promise<Quote[]> {
  if (!isSupabaseAvailable()) {
    console.log('💾 Loading quotes from memory storage');
    return await memoryStorage_.quotes.findAll();
  }

  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return data?.map(item => transformQuoteFromDB(item as unknown as DatabaseQuote)) || []
  } catch (error) {
    console.error('❌ Error loading quotes, falling back to memory:', error)
    return await memoryStorage_.quotes.findAll();
  }
}

export async function saveQuote(quote: Quote) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for quote');
    await memoryStorage_.quotes.create(quote);
    return;
  }

  try {
    const dbQuote = transformQuoteToDB(quote)
    
    const { error } = await supabase
      .from('quotes')
      .upsert(dbQuote, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
    
    if (error) throw error
    console.log('✅ Quote saved to Supabase:', quote.id)
  } catch (error) {
    console.error('❌ Error saving quote, falling back to memory:', error)
    await memoryStorage_.quotes.create(quote);
  }
}

export async function deleteQuote(quoteId: string) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for quote deletion');
    await memoryStorage_.quotes.delete(quoteId);
    return;
  }

  try {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)
    
    if (error) throw error
    console.log('✅ Quote deleted from Supabase:', quoteId)
  } catch (error) {
    console.error('❌ Error deleting quote, falling back to memory:', error)
    await memoryStorage_.quotes.delete(quoteId);
  }
}

// Transcripts
export async function saveTranscript(sourceId: string, transcript: Transcript) {
  if (!isSupabaseAvailable()) {
    console.log('💾 Using memory storage for transcript');
    await memoryStorage_.transcripts.save(transcript);
    return;
  }

  try {
    const { error } = await supabase
      .from('transcripts')
      .upsert({
        id: `transcript_${sourceId}`,
        source_id: sourceId,
        segments: transcript.segments,
        words: transcript.words || [],
        speakers: transcript.speakers || [],
      }, { 
        onConflict: 'source_id',
        ignoreDuplicates: false 
      })
    
    if (error) throw error
    console.log('✅ Transcript saved to Supabase:', sourceId)
  } catch (error) {
    console.error('❌ Error saving transcript, falling back to memory:', error)
    await memoryStorage_.transcripts.save(transcript);
  }
}

export async function loadTranscript(sourceId: string): Promise<Transcript | null> {
  if (!isSupabaseAvailable()) {
    console.log('💾 Loading transcript from memory storage');
    return await memoryStorage_.transcripts.load(sourceId);
  }

  try {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('source_id', sourceId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No transcript found
        return null
      }
      throw error
    }
    
    return {
      sourceId: data.source_id,
      segments: data.segments || [],
      words: data.words || [],
      speakers: data.speakers || [],
    }
  } catch (error) {
    console.error('❌ Error loading transcript, falling back to memory:', error)
    return await memoryStorage_.transcripts.load(sourceId);
  }
}

export async function loadAllTranscripts(): Promise<Map<string, Transcript>> {
  if (!isSupabaseAvailable()) {
    console.log('💾 Loading all transcripts from memory storage');
    const transcripts = await memoryStorage_.transcripts.findAll();
    const transcriptsMap = new Map<string, Transcript>();
    transcripts.forEach(transcript => {
      transcriptsMap.set(transcript.sourceId, transcript);
    });
    return transcriptsMap;
  }

  try {
    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
    
    if (error) throw error
    
    const transcriptsMap = new Map<string, Transcript>()
    
    data?.forEach(transcript => {
      transcriptsMap.set(transcript.source_id, {
        sourceId: transcript.source_id,
        segments: transcript.segments || [],
        words: transcript.words || [],
        speakers: transcript.speakers || [],
      })
    })
    
    return transcriptsMap
  } catch (error) {
    console.error('❌ Error loading transcripts, falling back to memory:', error)
    const transcripts = await memoryStorage_.transcripts.findAll();
    const transcriptsMap = new Map<string, Transcript>();
    transcripts.forEach(transcript => {
      transcriptsMap.set(transcript.sourceId, transcript);
    });
    return transcriptsMap;
  }
}