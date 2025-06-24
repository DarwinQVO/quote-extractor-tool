import { supabase, transformSourceFromDB, transformSourceToDB, transformQuoteFromDB, transformQuoteToDB, DatabaseSource, DatabaseQuote } from './supabase'
import { VideoSource, Quote, Transcript } from './types'

// Sources
export async function saveSources(sources: VideoSource[]) {
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
    console.error('❌ Error saving sources:', error)
  }
}

export async function loadSources(): Promise<VideoSource[]> {
  try {
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return data?.map(item => transformSourceFromDB(item as unknown as DatabaseSource)) || []
  } catch (error) {
    console.error('❌ Error loading sources:', error)
    return []
  }
}

export async function saveSource(source: VideoSource) {
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
    console.error('❌ Error saving source:', error)
  }
}

export async function deleteSource(sourceId: string) {
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
    console.error('❌ Error deleting source:', error)
  }
}

// Quotes
export async function saveQuotes(quotes: Quote[]) {
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
    console.error('❌ Error saving quotes:', error)
  }
}

export async function loadQuotes(): Promise<Quote[]> {
  try {
    const { data, error } = await supabase
      .from('quotes')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return data?.map(item => transformQuoteFromDB(item as unknown as DatabaseQuote)) || []
  } catch (error) {
    console.error('❌ Error loading quotes:', error)
    return []
  }
}

export async function saveQuote(quote: Quote) {
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
    console.error('❌ Error saving quote:', error)
  }
}

export async function deleteQuote(quoteId: string) {
  try {
    const { error } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId)
    
    if (error) throw error
    console.log('✅ Quote deleted from Supabase:', quoteId)
  } catch (error) {
    console.error('❌ Error deleting quote:', error)
  }
}

// Transcripts
export async function saveTranscript(sourceId: string, transcript: Transcript) {
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
    console.error('❌ Error saving transcript:', error)
  }
}

export async function loadTranscript(sourceId: string): Promise<Transcript | null> {
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
    console.error('❌ Error loading transcript:', error)
    return null
  }
}

export async function loadAllTranscripts(): Promise<Map<string, Transcript>> {
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
    console.error('❌ Error loading transcripts:', error)
    return new Map()
  }
}