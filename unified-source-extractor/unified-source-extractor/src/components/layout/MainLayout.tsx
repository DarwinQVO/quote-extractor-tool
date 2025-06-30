"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Grid3X3, 
  List, 
  Calendar,
  Map,
  BookOpen,
  Settings,
  Filter
} from "lucide-react";
import { useSourceStore } from "@/store/useSourceStore";

interface MainLayoutProps {
  children: React.ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { 
    viewMode, 
    setViewMode,
    searchQuery,
    setSearchQuery,
    getFilteredSources,
    getAllCategories,
    filters
  } = useSourceStore();
  
  const filteredSources = getFilteredSources();
  const hasActiveFilters = filters.types.length > 0 || 
                          filters.categories.length > 0 || 
                          filters.tags.length > 0 ||
                          filters.status.length > 0;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold">Unified Source</h1>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 px-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search sources, quotes, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>
      
      {/* Sub Navigation / Toolbar */}
      <div className="border-b px-4 py-2 bg-muted/30">
        <div className="container flex items-center justify-between">
          {/* View Mode Switcher */}
          <div className="flex items-center space-x-1">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="gap-2"
            >
              <Grid3X3 className="h-4 w-4" />
              Grid
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="gap-2"
            >
              <List className="h-4 w-4" />
              List
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="gap-2"
            >
              <Calendar className="h-4 w-4" />
              Timeline
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('map')}
              className="gap-2"
            >
              <Map className="h-4 w-4" />
              Map
            </Button>
          </div>
          
          {/* Stats and Filters */}
          <div className="flex items-center space-x-4">
            <span className="text-sm text-muted-foreground">
              {filteredSources.length} sources
              {hasActiveFilters && ' (filtered)'}
            </span>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2",
                hasActiveFilters && "border-primary text-primary"
              )}
            >
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden">
        <div className="h-full container px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}