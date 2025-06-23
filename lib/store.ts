import { create } from 'zustand';
import { VideoSource, Quote, Transcript } from './types';

interface AppState {
  sources: VideoSource[];
  quotes: Quote[];
  transcripts: Map<string, Transcript>;
  activeSourceId: string | null;
  
  addSource: (url: string) => string;
  updateSource: (id: string, updates: Partial<VideoSource>) => void;
  removeSource: (id: string) => void;
  setActiveSource: (id: string | null) => void;
  
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  removeQuote: (id: string) => void;
  
  setTranscript: (sourceId: string, transcript: Transcript) => void;
}

export const useStore = create<AppState>((set) => ({
  sources: [],
  quotes: [],
  transcripts: new Map(),
  activeSourceId: null,
  
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
    
    set((state) => ({ 
      sources: [...state.sources, newSource],
      activeSourceId: id 
    }));
    
    return id;
  },
  
  updateSource: (id, updates) => 
    set((state) => ({
      sources: state.sources.map((source) =>
        source.id === id ? { ...source, ...updates } : source
      ),
    })),
    
  removeSource: (id) =>
    set((state) => ({
      sources: state.sources.filter((source) => source.id !== id),
      quotes: state.quotes.filter((quote) => quote.sourceId !== id),
      activeSourceId: state.activeSourceId === id ? null : state.activeSourceId,
    })),
    
  setActiveSource: (id) => set({ activeSourceId: id }),
  
  addQuote: (quoteData) => {
    const quote: Quote = {
      ...quoteData,
      id: Date.now().toString(),
      createdAt: new Date(),
    };
    
    set((state) => ({ quotes: [...state.quotes, quote] }));
  },
  
  removeQuote: (id) =>
    set((state) => ({
      quotes: state.quotes.filter((quote) => quote.id !== id),
    })),
    
  setTranscript: (sourceId, transcript) =>
    set((state) => {
      const newTranscripts = new Map(state.transcripts);
      newTranscripts.set(sourceId, transcript);
      return { transcripts: newTranscripts };
    }),
}));