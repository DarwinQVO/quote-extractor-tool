"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useStore } from "@/lib/store";
import { formatDistanceToNow } from "date-fns";
import { FileText, Youtube, Globe, Play, Clock, User } from "lucide-react";

interface TranscriptWithSource {
  id: string;
  source_id: string;
  segments: Array<{
    text: string;
    start: number;
    end: number;
    speaker?: string;
  }>;
  words: any[];
  speakers: any[];
  created_at: string;
  source: {
    id: string;
    title: string;
    url: string;
    type: string;
    status: string;
    created_at: string;
  } | null;
}

export function TranscriptsPanel() {
  const [transcripts, setTranscripts] = useState<TranscriptWithSource[]>([]);
  const [loading, setLoading] = useState(true);
  // Note: These functions may not exist in the current store
  // const { setCurrentSource, setSelectedQuote } = useStore();

  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          *,
          source:sources(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading transcripts:', error);
      } else {
        setTranscripts(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTranscriptClick = (transcript: TranscriptWithSource) => {
    // This component is not currently being used
    console.log('Transcript clicked:', transcript);
  };

  const getSourceIcon = (type: string) => {
    switch (type) {
      case 'youtube':
      case 'video':
        return <Youtube className="h-5 w-5 text-red-500" />;
      case 'web':
        return <Globe className="h-5 w-5 text-blue-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDuration = (segments: any[]) => {
    if (!segments || segments.length === 0) return "0:00";
    const lastSegment = segments[segments.length - 1];
    const totalSeconds = lastSegment?.end || 0;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getWordCount = (segments: any[]) => {
    if (!segments) return 0;
    return segments.reduce((count, segment) => {
      return count + (segment.text?.split(/\s+/).length || 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className="h-full p-4 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-2"></div>
          <p className="text-sm text-gray-500">Loading transcripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Transcripts ({transcripts.length})
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Click any transcript to watch with synchronized playback
        </p>
      </div>

      {/* Transcript list */}
      <div className="flex-1 overflow-y-auto">
        {transcripts.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No transcripts yet</h3>
            <p className="text-gray-500">
              Add video sources to generate transcripts
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {transcripts.map((transcript) => {
              const wordCount = getWordCount(transcript.segments);
              const duration = formatDuration(transcript.segments);
              const readingTime = Math.ceil(wordCount / 200);

              return (
                <div
                  key={transcript.id}
                  onClick={() => handleTranscriptClick(transcript)}
                  className="group p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer bg-white"
                >
                  {/* Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                      {getSourceIcon(transcript.source?.type || '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                        {transcript.source?.title || 'Untitled'}
                      </h3>
                      <p className="text-sm text-gray-500 truncate mt-1">
                        {transcript.source?.url}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <Play className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {duration}
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {wordCount.toLocaleString()} words
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {readingTime} min read
                    </div>
                  </div>

                  {/* Preview */}
                  {transcript.segments && transcript.segments.length > 0 && (
                    <div className="text-sm text-gray-600 leading-relaxed">
                      <p className="line-clamp-2">
                        {transcript.segments
                          .slice(0, 3)
                          .map(seg => seg.text)
                          .join(' ')
                          .substring(0, 120)}...
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(transcript.created_at), { addSuffix: true })}
                    </span>
                    <div className="text-xs font-medium text-blue-600 group-hover:text-blue-700 transition-colors">
                      ▶ Watch with Transcript
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}