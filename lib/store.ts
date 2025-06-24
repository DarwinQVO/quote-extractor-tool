import { create } from 'zustand';
import { VideoSource, Quote, Transcript } from './types';
import { 
  saveSources, 
  loadSources, 
  saveSource, 
  saveQuotes, 
  loadQuotes, 
  saveTranscript,
  loadAllTranscripts
} from './database';

interface AppState {
  sources: VideoSource[];
  quotes: Quote[];
  transcripts: Map<string, Transcript>;
  activeSourceId: string | null;
  transcriptionProgress: Map<string, number>;
  isOnline: boolean;
  lastSyncTime: number;
  
  addSource: (url: string) => string;
  updateSource: (id: string, updates: Partial<VideoSource>) => void;
  removeSource: (id: string) => void;
  setActiveSource: (id: string | null) => void;
  
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  updateMultipleQuotes: (updates: Array<{ id: string; updates: Partial<Quote> }>) => void;
  removeQuote: (id: string) => void;
  markQuotesAsExported: (quoteIds: string[]) => void;
  
  setTranscript: (sourceId: string, transcript: Transcript) => void;
  updateTranscript: (sourceId: string, updates: Partial<Transcript>) => void;
  setTranscriptionProgress: (sourceId: string, progress: number) => void;
  
  // Sync functions
  loadFromDatabase: () => Promise<void>;
  syncToDatabase: () => Promise<void>;
  setOnlineStatus: (online: boolean) => void;
}

// Load from localStorage with error handling and date parsing
const loadFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return defaultValue;
    
    const parsed = JSON.parse(stored);
    
    // Handle date parsing for sources and quotes
    if (key === 'quote-extractor-sources' && Array.isArray(parsed)) {
      return parsed.map(source => ({
        ...source,
        addedAt: new Date(source.addedAt),
        uploadDate: source.uploadDate ? new Date(source.uploadDate) : undefined,
      })) as T;
    }
    
    if (key === 'quote-extractor-quotes' && Array.isArray(parsed)) {
      return parsed.map(quote => ({
        ...quote,
        createdAt: new Date(quote.createdAt),
      })) as T;
    }
    
    return parsed;
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
    return defaultValue;
  }
};

// Save to localStorage with error handling
const saveToStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

// Convert Map to array for storage
const mapToArray = (map: Map<string, unknown>) => Array.from(map.entries());
const arrayToMap = (array: [string, unknown][]) => new Map(array);

export const useStore = create<AppState>((set, get) => ({
  sources: loadFromStorage('quote-extractor-sources', []),
  quotes: loadFromStorage('quote-extractor-quotes', []),
  transcripts: arrayToMap(loadFromStorage('quote-extractor-transcripts', [])) as Map<string, Transcript>,
  activeSourceId: loadFromStorage('quote-extractor-activeSourceId', null),
  transcriptionProgress: new Map(),
  isOnline: typeof window !== 'undefined' ? navigator.onLine : true,
  lastSyncTime: loadFromStorage('quote-extractor-lastSync', 0),
  
  addSource: (url) => {
    const id = Date.now().toString();
    const newSource: VideoSource = {
      id,
      url,
      title: 'Loading...',
      channel: '',
      duration: 0,
      thumbnail: '',
      addedAt: new Date(),
      status: 'fetching-metadata',
    };
    
    set((state) => {
      const newState = { 
        sources: [...state.sources, newSource],
        activeSourceId: id 
      };
      saveToStorage('quote-extractor-sources', newState.sources);
      saveToStorage('quote-extractor-activeSourceId', newState.activeSourceId);
      
      // Sync to database if online
      if (state.isOnline) {
        saveSource(newSource).catch(console.error);
      }
      
      return newState;
    });
    
    return id;
  },
  
  updateSource: (id, updates) => 
    set((state) => {
      const newSources = state.sources.map((source) =>
        source.id === id ? { ...source, ...updates } : source
      );
      saveToStorage('quote-extractor-sources', newSources);
      return { sources: newSources };
    }),
    
  removeSource: (id) =>
    set((state) => {
      const newSources = state.sources.filter((source) => source.id !== id);
      const newQuotes = state.quotes.filter((quote) => quote.sourceId !== id);
      const newActiveSourceId = state.activeSourceId === id ? null : state.activeSourceId;
      const newTranscripts = new Map(state.transcripts);
      newTranscripts.delete(id);
      
      saveToStorage('quote-extractor-sources', newSources);
      saveToStorage('quote-extractor-quotes', newQuotes);
      saveToStorage('quote-extractor-activeSourceId', newActiveSourceId);
      saveToStorage('quote-extractor-transcripts', mapToArray(newTranscripts));
      
      // Sync removal to database if online
      if (state.isOnline) {
        import('./database').then(({ deleteSource }) => {
          deleteSource(id).catch(console.error);
        });
      }
      
      return {
        sources: newSources,
        quotes: newQuotes,
        activeSourceId: newActiveSourceId,
        transcripts: newTranscripts,
      };
    }),
    
  setActiveSource: (id) => set(() => {
    saveToStorage('quote-extractor-activeSourceId', id);
    return { activeSourceId: id };
  }),
  
  addQuote: (quoteData) => {
    const quote: Quote = {
      ...quoteData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    set((state) => {
      const newQuotes = [...state.quotes, quote];
      saveToStorage('quote-extractor-quotes', newQuotes);
      return { quotes: newQuotes };
    });
  },
  
  updateQuote: (id, updates) =>
    set((state) => {
      const newQuotes = state.quotes.map((quote) =>
        quote.id === id ? { ...quote, ...updates } : quote
      );
      saveToStorage('quote-extractor-quotes', newQuotes);
      return { quotes: newQuotes };
    }),
    
  updateMultipleQuotes: (updates) =>
    set((state) => {
      const updateMap = new Map(updates.map(u => [u.id, u.updates]));
      const newQuotes = state.quotes.map((quote) => {
        const update = updateMap.get(quote.id);
        return update ? { ...quote, ...update } : quote;
      });
      saveToStorage('quote-extractor-quotes', newQuotes);
      return { quotes: newQuotes };
    }),
  
  removeQuote: (id) =>
    set((state) => {
      const newQuotes = state.quotes.filter((quote) => quote.id !== id);
      saveToStorage('quote-extractor-quotes', newQuotes);
      return { quotes: newQuotes };
    }),
    
  markQuotesAsExported: (quoteIds) =>
    set((state) => {
      const newQuotes = state.quotes.map((quote) =>
        quoteIds.includes(quote.id) ? { ...quote, exported: true } : quote
      );
      saveToStorage('quote-extractor-quotes', newQuotes);
      return { quotes: newQuotes };
    }),
    
  setTranscript: (sourceId, transcript) =>
    set((state) => {
      const newTranscripts = new Map(state.transcripts);
      newTranscripts.set(sourceId, transcript);
      saveToStorage('quote-extractor-transcripts', mapToArray(newTranscripts));
      return { transcripts: newTranscripts };
    }),
    
  updateTranscript: (sourceId, updates) =>
    set((state) => {
      const currentTranscript = state.transcripts.get(sourceId);
      if (!currentTranscript) return state;
      
      const newTranscripts = new Map(state.transcripts);
      newTranscripts.set(sourceId, { ...currentTranscript, ...updates });
      saveToStorage('quote-extractor-transcripts', mapToArray(newTranscripts));
      return { transcripts: newTranscripts };
    }),
    
  setTranscriptionProgress: (sourceId, progress) =>
    set((state) => {
      const newProgress = new Map(state.transcriptionProgress);
      newProgress.set(sourceId, progress);
      return { transcriptionProgress: newProgress };
    }),
    
  // Sync functions
  loadFromDatabase: async () => {
    try {
      const [dbSources, dbQuotes, dbTranscripts] = await Promise.all([
        loadSources(),
        loadQuotes(),
        loadAllTranscripts()
      ]);
      
      set({
        sources: dbSources,
        quotes: dbQuotes,
        transcripts: dbTranscripts,
        lastSyncTime: Date.now(),
      });
      
      // Update localStorage with fresh data
      saveToStorage('quote-extractor-sources', dbSources);
      saveToStorage('quote-extractor-quotes', dbQuotes);
      saveToStorage('quote-extractor-transcripts', mapToArray(dbTranscripts));
      saveToStorage('quote-extractor-lastSync', Date.now());
      
      console.log('✅ Data loaded from database');
    } catch (error) {
      console.error('❌ Failed to load from database:', error);
    }
  },
  
  syncToDatabase: async () => {
    const state = get();
    if (!state.isOnline) {
      console.log('⏳ Offline - sync queued for when online');
      return;
    }
    
    try {
      await Promise.all([
        saveSources(state.sources),
        saveQuotes(state.quotes),
        ...Array.from(state.transcripts.entries()).map(([sourceId, transcript]) =>
          saveTranscript(sourceId, transcript)
        )
      ]);
      
      set({ lastSyncTime: Date.now() });
      saveToStorage('quote-extractor-lastSync', Date.now());
      
      console.log('✅ Data synced to database');
    } catch (error) {
      console.error('❌ Failed to sync to database:', error);
    }
  },
  
  setOnlineStatus: (online) => set({ isOnline: online }),
}));