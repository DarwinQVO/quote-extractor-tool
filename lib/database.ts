import { supabase, transformSourceFromDB, transformSourceToDB, transformQuoteFromDB, transformQuoteToDB, DatabaseSource, DatabaseQuote } from './supabase'
import { VideoSource, Quote, Transcript } from './types'

// PRODUCTION MODE: NO MEMORY STORAGE - SUPABASE ONLY
console.log('🔥 DATABASE MODULE: Configured for SUPABASE ONLY - NO memory fallback')

// Check if Supabase is available
function isSupabaseAvailable(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const available = !!(url && key && url !== 'build-placeholder' && key !== 'build-placeholder');
  
  // ALWAYS force Supabase usage in production - NO MEMORY FALLBACK
  if (process.env.NODE_ENV === 'production' && available) {
    console.log('🔄 PRODUCTION: Using ONLY Supabase - NO memory fallback');
    return true;
  }
  
  // In development, also prefer Supabase if available
  if (available) {
    console.log('🔄 Development: Using Supabase');
    return true;
  }
  
  console.warn('⚠️ Supabase not available, using memory fallback');
  return false;
}

// Sources
export async function saveSources(sources: VideoSource[]) {
  console.log('🔥 PRODUCTION: Using ONLY Supabase - NO memory fallback allowed');
  
  const dbSources = sources.map(transformSourceToDB)
  
  const { error } = await supabase
    .from('sources')
    .upsert(dbSources, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })
  
  if (error) {
    console.error('❌ Supabase error:', error)
    throw new Error(`Supabase save failed: ${error.message}`)
  }
  
  console.log('✅ Sources saved to Supabase ONLY')
}

export async function loadSources(): Promise<VideoSource[]> {
  console.log('🔥 PRODUCTION: Loading from ONLY Supabase - NO memory fallback');
  
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ Supabase load error:', error)
    throw new Error(`Supabase load failed: ${error.message}`)
  }
  
  console.log(`✅ Loaded ${data?.length || 0} sources from Supabase ONLY`)
  return data?.map(item => transformSourceFromDB(item as unknown as DatabaseSource)) || []
}

export async function updateSource(sourceId: string, updates: Partial<VideoSource>) {
  console.log('🔥 PRODUCTION: Updating in ONLY Supabase');
  
  const dbUpdates = transformSourceToDB(updates as VideoSource);
  
  const { error } = await supabase
    .from('sources')
    .update(dbUpdates)
    .eq('id', sourceId);
  
  if (error) {
    console.error('❌ Supabase update error:', error);
    throw new Error(`Supabase update failed: ${error.message}`);
  }
  
  console.log('✅ Source updated in Supabase ONLY:', sourceId);
  return updates as VideoSource;
}

export async function saveSource(source: VideoSource) {
  console.log('🔥 PRODUCTION: Saving to ONLY Supabase');
  
  const dbSource = transformSourceToDB(source)
  
  const { error } = await supabase
    .from('sources')
    .upsert(dbSource, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })
  
  if (error) {
    console.error('❌ Supabase save error:', error)
    throw new Error(`Supabase save failed: ${error.message}`)
  }
  
  console.log('✅ Source saved to Supabase ONLY:', source.id)
}

export async function deleteSource(sourceId: string) {
  console.log('🔥 PRODUCTION: Deleting from ONLY Supabase');
  
  // Delete related data first
  await supabase.from('quotes').delete().eq('source_id', sourceId)
  await supabase.from('transcripts').delete().eq('source_id', sourceId)
  
  // Delete source
  const { error } = await supabase
    .from('sources')
    .delete()
    .eq('id', sourceId)
  
  if (error) {
    console.error('❌ Supabase delete error:', error)
    throw new Error(`Supabase delete failed: ${error.message}`)
  }
  
  console.log('✅ Source deleted from Supabase ONLY:', sourceId)
}

// Quotes
export async function saveQuotes(quotes: Quote[]) {
  console.log('🔥 PRODUCTION: Saving quotes to ONLY Supabase');
  
  const dbQuotes = quotes.map(transformQuoteToDB)
  
  const { error } = await supabase
    .from('quotes')
    .upsert(dbQuotes, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })
  
  if (error) {
    console.error('❌ Supabase quotes error:', error)
    throw new Error(`Supabase quotes save failed: ${error.message}`)
  }
  
  console.log('✅ Quotes saved to Supabase ONLY')
}

export async function loadQuotes(): Promise<Quote[]> {
  console.log('🔥 PRODUCTION: Loading quotes from ONLY Supabase');
  
  const { data, error } = await supabase
    .from('quotes')
    .select('*')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('❌ Supabase quotes load error:', error)
    throw new Error(`Supabase quotes load failed: ${error.message}`)
  }
  
  console.log(`✅ Loaded ${data?.length || 0} quotes from Supabase ONLY`)
  return data?.map(item => transformQuoteFromDB(item as unknown as DatabaseQuote)) || []
}

export async function saveQuote(quote: Quote) {
  console.log('🔥 PRODUCTION: Saving quote to ONLY Supabase');
  
  const dbQuote = transformQuoteToDB(quote)
  
  const { error } = await supabase
    .from('quotes')
    .upsert(dbQuote, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    })
  
  if (error) {
    console.error('❌ Supabase quote error:', error)
    throw new Error(`Supabase quote save failed: ${error.message}`)
  }
  
  console.log('✅ Quote saved to Supabase ONLY:', quote.id)
}

export async function deleteQuote(quoteId: string) {
  console.log('🔥 PRODUCTION: Deleting quote from ONLY Supabase');
  
  const { error } = await supabase
    .from('quotes')
    .delete()
    .eq('id', quoteId)
  
  if (error) {
    console.error('❌ Supabase quote delete error:', error)
    throw new Error(`Supabase quote delete failed: ${error.message}`)
  }
  
  console.log('✅ Quote deleted from Supabase ONLY:', quoteId)
}

// Transcripts
export async function saveTranscript(sourceId: string, transcript: Transcript) {
  console.log('🔥 PRODUCTION: Saving transcript to ONLY Supabase');
  
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
  
  if (error) {
    console.error('❌ Supabase transcript error:', error)
    throw new Error(`Supabase transcript save failed: ${error.message}`)
  }
  
  console.log('✅ Transcript saved to Supabase ONLY:', sourceId)
}

export async function loadTranscript(sourceId: string): Promise<Transcript | null> {
  console.log('🔥 PRODUCTION: Loading transcript from ONLY Supabase');
  
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
    .eq('source_id', sourceId)
    .single()
  
  if (error) {
    if (error.code === 'PGRST116') {
      // No transcript found
      console.log('ℹ️ No transcript found for:', sourceId)
      return null
    }
    console.error('❌ Supabase transcript load error:', error)
    throw new Error(`Supabase transcript load failed: ${error.message}`)
  }
  
  console.log('✅ Transcript loaded from Supabase ONLY:', sourceId)
  return {
    sourceId: data.source_id,
    segments: data.segments || [],
    words: data.words || [],
    speakers: data.speakers || [],
  }
}

export async function loadAllTranscripts(): Promise<Map<string, Transcript>> {
  console.log('🔥 PRODUCTION: Loading all transcripts from ONLY Supabase');
  
  const { data, error } = await supabase
    .from('transcripts')
    .select('*')
  
  if (error) {
    console.error('❌ Supabase all transcripts load error:', error)
    throw new Error(`Supabase all transcripts load failed: ${error.message}`)
  }
  
  const transcriptsMap = new Map<string, Transcript>()
  
  data?.forEach(transcript => {
    transcriptsMap.set(transcript.source_id, {
      sourceId: transcript.source_id,
      segments: transcript.segments || [],
      words: transcript.words || [],
      speakers: transcript.speakers || [],
    })
  })
  
  console.log(`✅ Loaded ${transcriptsMap.size} transcripts from Supabase ONLY`)
  return transcriptsMap
}