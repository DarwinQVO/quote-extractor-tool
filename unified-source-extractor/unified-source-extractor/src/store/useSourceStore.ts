import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Source, SourceType, SourceStatus, Quote, Character, Collection } from '@/lib/types';

interface SourceState {
  // Sources
  sources: Source[];
  selectedSourceId: string | null;
  sourcesLoading: boolean;
  sourcesError: string | null;
  
  // Quotes
  quotes: Quote[];
  selectedQuoteId: string | null;
  quotesLoading: boolean;
  quotesError: string | null;
  
  // Characters
  characters: Character[];
  
  // Collections
  collections: Collection[];
  activeCollectionId: string | null;
  
  // Filters and search
  searchQuery: string;
  filters: {
    types: SourceType[];
    categories: string[];
    tags: string[];
    status: SourceStatus[];
    dateRange?: { start: Date; end: Date };
  };
  
  // View state
  viewMode: 'grid' | 'list' | 'timeline' | 'map';
  sortBy: 'date' | 'title' | 'type';
  sortOrder: 'asc' | 'desc';
}

interface SourceActions {
  // Source actions
  setSources: (sources: Source[]) => void;
  addSource: (source: Source) => void;
  updateSource: (id: string, updates: Partial<Source>) => void;
  deleteSource: (id: string) => void;
  selectSource: (id: string | null) => void;
  
  // Quote actions
  setQuotes: (quotes: Quote[]) => void;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  selectQuote: (id: string | null) => void;
  
  // Character actions
  setCharacters: (characters: Character[]) => void;
  addCharacter: (character: Character) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  
  // Collection actions
  setCollections: (collections: Collection[]) => void;
  addCollection: (collection: Collection) => void;
  updateCollection: (id: string, updates: Partial<Collection>) => void;
  deleteCollection: (id: string) => void;
  setActiveCollection: (id: string | null) => void;
  
  // Filter and search actions
  setSearchQuery: (query: string) => void;
  setTypeFilter: (types: SourceType[]) => void;
  setCategoryFilter: (categories: string[]) => void;
  setTagFilter: (tags: string[]) => void;
  setStatusFilter: (statuses: SourceStatus[]) => void;
  setDateRangeFilter: (range: { start: Date; end: Date } | undefined) => void;
  clearFilters: () => void;
  
  // View actions
  setViewMode: (mode: 'grid' | 'list' | 'timeline' | 'map') => void;
  setSortBy: (sortBy: 'date' | 'title' | 'type') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  
  // Loading and error states
  setSourcesLoading: (loading: boolean) => void;
  setSourcesError: (error: string | null) => void;
  setQuotesLoading: (loading: boolean) => void;
  setQuotesError: (error: string | null) => void;
  
  // Computed getters
  getFilteredSources: () => Source[];
  getSourceQuotes: (sourceId: string) => Quote[];
  getCharacterQuotes: (characterId: string) => Quote[];
  getAllCategories: () => string[];
  getAllTags: () => string[];
}

type SourceStore = SourceState & SourceActions;

const initialFilters = {
  types: [] as SourceType[],
  categories: [] as string[],
  tags: [] as string[],
  status: [] as SourceStatus[],
  dateRange: undefined,
};

export const useSourceStore = create<SourceStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        sources: [],
        selectedSourceId: null,
        sourcesLoading: false,
        sourcesError: null,
        
        quotes: [],
        selectedQuoteId: null,
        quotesLoading: false,
        quotesError: null,
        
        characters: [],
        collections: [],
        activeCollectionId: null,
        
        searchQuery: '',
        filters: initialFilters,
        
        viewMode: 'grid',
        sortBy: 'date',
        sortOrder: 'desc',
        
        // Source actions
        setSources: (sources) => set({ sources }),
        addSource: (source) => set((state) => ({ sources: [...state.sources, source] })),
        updateSource: (id, updates) => set((state) => ({
          sources: state.sources.map((s) => s.id === id ? { ...s, ...updates } : s)
        })),
        deleteSource: (id) => set((state) => ({
          sources: state.sources.filter((s) => s.id !== id),
          quotes: state.quotes.filter((q) => q.source_id !== id),
        })),
        selectSource: (id) => set({ selectedSourceId: id }),
        
        // Quote actions
        setQuotes: (quotes) => set({ quotes }),
        addQuote: (quote) => set((state) => ({ quotes: [...state.quotes, quote] })),
        updateQuote: (id, updates) => set((state) => ({
          quotes: state.quotes.map((q) => q.id === id ? { ...q, ...updates } : q)
        })),
        deleteQuote: (id) => set((state) => ({
          quotes: state.quotes.filter((q) => q.id !== id)
        })),
        selectQuote: (id) => set({ selectedQuoteId: id }),
        
        // Character actions
        setCharacters: (characters) => set({ characters }),
        addCharacter: (character) => set((state) => ({ 
          characters: [...state.characters, character] 
        })),
        updateCharacter: (id, updates) => set((state) => ({
          characters: state.characters.map((c) => c.id === id ? { ...c, ...updates } : c)
        })),
        deleteCharacter: (id) => set((state) => ({
          characters: state.characters.filter((c) => c.id !== id),
          quotes: state.quotes.map((q) => ({
            ...q,
            character_ids: q.character_ids.filter((cId) => cId !== id)
          }))
        })),
        
        // Collection actions
        setCollections: (collections) => set({ collections }),
        addCollection: (collection) => set((state) => ({ 
          collections: [...state.collections, collection] 
        })),
        updateCollection: (id, updates) => set((state) => ({
          collections: state.collections.map((c) => c.id === id ? { ...c, ...updates } : c)
        })),
        deleteCollection: (id) => set((state) => ({
          collections: state.collections.filter((c) => c.id !== id),
          activeCollectionId: state.activeCollectionId === id ? null : state.activeCollectionId
        })),
        setActiveCollection: (id) => set({ activeCollectionId: id }),
        
        // Filter and search actions
        setSearchQuery: (query) => set({ searchQuery: query }),
        setTypeFilter: (types) => set((state) => ({ 
          filters: { ...state.filters, types } 
        })),
        setCategoryFilter: (categories) => set((state) => ({ 
          filters: { ...state.filters, categories } 
        })),
        setTagFilter: (tags) => set((state) => ({ 
          filters: { ...state.filters, tags } 
        })),
        setStatusFilter: (status) => set((state) => ({ 
          filters: { ...state.filters, status } 
        })),
        setDateRangeFilter: (dateRange) => set((state) => ({ 
          filters: { ...state.filters, dateRange } 
        })),
        clearFilters: () => set({ filters: initialFilters, searchQuery: '' }),
        
        // View actions
        setViewMode: (viewMode) => set({ viewMode }),
        setSortBy: (sortBy) => set({ sortBy }),
        setSortOrder: (sortOrder) => set({ sortOrder }),
        
        // Loading and error states
        setSourcesLoading: (sourcesLoading) => set({ sourcesLoading }),
        setSourcesError: (sourcesError) => set({ sourcesError }),
        setQuotesLoading: (quotesLoading) => set({ quotesLoading }),
        setQuotesError: (quotesError) => set({ quotesError }),
        
        // Computed getters
        getFilteredSources: () => {
          const state = get();
          let filtered = state.sources;
          
          // Apply search filter
          if (state.searchQuery) {
            const query = state.searchQuery.toLowerCase();
            filtered = filtered.filter((source) => 
              source.title.toLowerCase().includes(query) ||
              source.description?.toLowerCase().includes(query) ||
              source.author?.toLowerCase().includes(query) ||
              source.categories.some(cat => cat.toLowerCase().includes(query)) ||
              source.tags.some(tag => tag.toLowerCase().includes(query))
            );
          }
          
          // Apply type filter
          if (state.filters.types.length > 0) {
            filtered = filtered.filter((source) => 
              state.filters.types.includes(source.type)
            );
          }
          
          // Apply category filter
          if (state.filters.categories.length > 0) {
            filtered = filtered.filter((source) =>
              source.categories.some(cat => state.filters.categories.includes(cat))
            );
          }
          
          // Apply tag filter
          if (state.filters.tags.length > 0) {
            filtered = filtered.filter((source) =>
              source.tags.some(tag => state.filters.tags.includes(tag))
            );
          }
          
          // Apply status filter
          if (state.filters.status.length > 0) {
            filtered = filtered.filter((source) =>
              state.filters.status.includes(source.status)
            );
          }
          
          // Apply date range filter
          if (state.filters.dateRange) {
            filtered = filtered.filter((source) => {
              const date = new Date(source.created_at);
              return date >= state.filters.dateRange!.start && 
                     date <= state.filters.dateRange!.end;
            });
          }
          
          // Apply collection filter if active
          if (state.activeCollectionId) {
            const collection = state.collections.find(c => c.id === state.activeCollectionId);
            if (collection) {
              filtered = filtered.filter((source) =>
                collection.source_ids.includes(source.id)
              );
            }
          }
          
          // Sort results
          filtered.sort((a, b) => {
            let comparison = 0;
            
            switch (state.sortBy) {
              case 'date':
                comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                break;
              case 'title':
                comparison = a.title.localeCompare(b.title);
                break;
              case 'type':
                comparison = a.type.localeCompare(b.type);
                break;
            }
            
            return state.sortOrder === 'desc' ? -comparison : comparison;
          });
          
          return filtered;
        },
        
        getSourceQuotes: (sourceId) => {
          return get().quotes.filter((quote) => quote.source_id === sourceId);
        },
        
        getCharacterQuotes: (characterId) => {
          return get().quotes.filter((quote) => 
            quote.character_ids.includes(characterId)
          );
        },
        
        getAllCategories: () => {
          const categories = new Set<string>();
          get().sources.forEach((source) => {
            source.categories.forEach((cat) => categories.add(cat));
          });
          return Array.from(categories).sort();
        },
        
        getAllTags: () => {
          const tags = new Set<string>();
          get().sources.forEach((source) => {
            source.tags.forEach((tag) => tags.add(tag));
          });
          get().quotes.forEach((quote) => {
            quote.tags.forEach((tag) => tags.add(tag));
          });
          return Array.from(tags).sort();
        },
      }),
      {
        name: 'unified-source-store',
        partialize: (state) => ({
          // Only persist view preferences and collections
          viewMode: state.viewMode,
          sortBy: state.sortBy,
          sortOrder: state.sortOrder,
          activeCollectionId: state.activeCollectionId,
        }),
      }
    )
  )
);