import { supabase, transformSourceFromDB, transformSourceToDB, transformQuoteFromDB, transformQuoteToDB, DatabaseSource, DatabaseQuote } from './supabase'
import { VideoSource, Quote, Transcript } from './types'

// Check if Supabase is properly configured
function isSupabaseConfigured(): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  return !!(supabaseUrl && 
            supabaseAnonKey && 
            supabaseUrl !== 'build-placeholder' && 
            supabaseAnonKey !== 'build-placeholder' &&
            supabaseUrl.includes('supabase.co'));
}

// Fallback API calls for when Supabase is not configured
async function fallbackApiCall(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(`/api/database/${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Fallback API call to ${endpoint} failed:`, error);
    throw error;
  }
}

// Sources
export async function saveSources(sources: VideoSource[]) {
  try {
    if (isSupabaseConfigured()) {
      const dbSources = sources.map(transformSourceToDB)
      
      const { error } = await supabase
        .from('sources')
        .upsert(dbSources, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error
      console.log('Sources saved to Supabase')
    } else {
      await fallbackApiCall('sources', {
        method: 'POST',
        body: JSON.stringify(sources),
      });
      console.log('Sources saved to SQLite fallback')
    }
  } catch (error) {
    console.error('Error saving sources:', error)
  }
}

export async function loadSources(): Promise<VideoSource[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return data?.map(item => transformSourceFromDB(item as unknown as DatabaseSource)) || []
    } else {
      const sources = await fallbackApiCall('sources');
      return sources || []
    }
  } catch (error) {
    console.error('Error loading sources:', error)
    return []
  }
}

export async function saveSource(source: VideoSource) {
  try {
    if (isSupabaseConfigured()) {
      const dbSource = transformSourceToDB(source)
      
      const { error } = await supabase
        .from('sources')
        .upsert(dbSource, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error
      console.log('Source saved to Supabase:', source.id)
    } else {
      await fallbackApiCall('sources', {
        method: 'POST',
        body: JSON.stringify([source]),
      });
      console.log('Source saved to SQLite fallback:', source.id)
    }
  } catch (error) {
    console.error('Error saving source:', error)
  }
}

export async function deleteSource(sourceId: string) {
  try {
    if (isSupabaseConfigured()) {
      // Delete related data first
      await supabase.from('quotes').delete().eq('source_id', sourceId)
      await supabase.from('transcripts').delete().eq('source_id', sourceId)
      
      // Delete source
      const { error } = await supabase
        .from('sources')
        .delete()
        .eq('id', sourceId)
      
      if (error) throw error
      console.log('Source deleted from Supabase:', sourceId)
    } else {
      await fallbackApiCall(`sources?id=${sourceId}`, {
        method: 'DELETE',
      });
      console.log('Source deleted from SQLite fallback:', sourceId)
    }
  } catch (error) {
    console.error('Error deleting source:', error)
  }
}

// Quotes
export async function saveQuotes(quotes: Quote[]) {
  try {
    if (isSupabaseConfigured()) {
      const dbQuotes = quotes.map(transformQuoteToDB)
      
      const { error } = await supabase
        .from('quotes')
        .upsert(dbQuotes, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error
      console.log('Quotes saved to Supabase')
    } else {
      await fallbackApiCall('quotes', {
        method: 'POST',
        body: JSON.stringify(quotes),
      });
      console.log('Quotes saved to SQLite fallback')
    }
  } catch (error) {
    console.error('Error saving quotes:', error)
  }
}

export async function loadQuotes(): Promise<Quote[]> {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      return data?.map(item => transformQuoteFromDB(item as unknown as DatabaseQuote)) || []
    } else {
      const quotes = await fallbackApiCall('quotes');
      return quotes || []
    }
  } catch (error) {
    console.error('Error loading quotes:', error)
    return []
  }
}

export async function saveQuote(quote: Quote) {
  try {
    if (isSupabaseConfigured()) {
      const dbQuote = transformQuoteToDB(quote)
      
      const { error } = await supabase
        .from('quotes')
        .upsert(dbQuote, { 
          onConflict: 'id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error
      console.log('Quote saved to Supabase:', quote.id)
    } else {
      await fallbackApiCall('quotes', {
        method: 'POST',
        body: JSON.stringify([quote]),
      });
      console.log('Quote saved to SQLite fallback:', quote.id)
    }
  } catch (error) {
    console.error('Error saving quote:', error)
  }
}

export async function deleteQuote(quoteId: string) {
  try {
    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('quotes')
        .delete()
        .eq('id', quoteId)
      
      if (error) throw error
      console.log('Quote deleted from Supabase:', quoteId)
    } else {
      await fallbackApiCall(`quotes?id=${quoteId}`, {
        method: 'DELETE',
      });
      console.log('Quote deleted from SQLite fallback:', quoteId)
    }
  } catch (error) {
    console.error('Error deleting quote:', error)
  }
}

// Transcripts
export async function saveTranscript(sourceId: string, transcript: Transcript) {
  try {
    if (isSupabaseConfigured()) {
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
      console.log('Transcript saved to Supabase:', sourceId)
    } else {
      await fallbackApiCall('transcripts', {
        method: 'POST',
        body: JSON.stringify({
          sourceId: sourceId,
          segments: transcript.segments,
          words: transcript.words || [],
          speakers: transcript.speakers || [],
        }),
      });
      console.log('Transcript saved to SQLite fallback:', sourceId)
    }
  } catch (error) {
    console.error('Error saving transcript:', error)
  }
}

export async function loadTranscript(sourceId: string): Promise<Transcript | null> {
  try {
    if (isSupabaseConfigured()) {
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
    } else {
      const transcripts = await fallbackApiCall('transcripts');
      return transcripts[sourceId] || null
    }
  } catch (error) {
    console.error('Error loading transcript:', error)
    return null
  }
}

export async function loadAllTranscripts(): Promise<Map<string, Transcript>> {
  try {
    if (isSupabaseConfigured()) {
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
    } else {
      const transcriptsData = await fallbackApiCall('transcripts');
      const transcriptsMap = new Map<string, Transcript>();
      
      Object.entries(transcriptsData).forEach(([sourceId, transcript]) => {
        transcriptsMap.set(sourceId, transcript as Transcript);
      });
      
      return transcriptsMap
    }
  } catch (error) {
    console.error('Error loading transcripts:', error)
    return new Map()
  }
}