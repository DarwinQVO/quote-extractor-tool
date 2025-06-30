"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { TranscriptViewer } from "@/components/transcript/TranscriptViewer";

interface Source {
  id: string;
  title: string;
  url: string;
  type: string;
  status: string;
  created_at: string;
}

interface Quote {
  id: string;
  source_id: string;
  text: string;
  timestamp?: string;
  created_at: string;
  source?: Source;
}

interface TranscriptSegment {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface Transcript {
  id: string;
  source_id: string;
  segments: TranscriptSegment[];
  words: any[];
  speakers: any[];
  created_at: string;
  source?: Source;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'sources' | 'quotes' | 'transcripts'>('sources');
  const [showModal, setShowModal] = useState(false);
  const [selectedType, setSelectedType] = useState<'youtube' | 'web' | 'document' | null>(null);
  const [url, setUrl] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTranscripts, setExpandedTranscripts] = useState<{ [key: string]: boolean }>({});
  const [selectedTranscript, setSelectedTranscript] = useState<Transcript | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('sources')
        .select('*')
        .order('created_at', { ascending: false });

      if (sourcesError) {
        console.error('Error loading sources:', sourcesError);
      } else {
        setSources(sourcesData || []);
      }

      // Load quotes with source info
      const { data: quotesData, error: quotesError } = await supabase
        .from('quotes')
        .select(`
          *,
          source:sources(*)
        `)
        .order('created_at', { ascending: false });

      if (quotesError) {
        console.error('Error loading quotes:', quotesError);
      } else {
        setQuotes(quotesData || []);
      }

      // Load transcripts with source info
      const { data: transcriptsData, error: transcriptsError } = await supabase
        .from('transcripts')
        .select(`
          *,
          source:sources(*)
        `)
        .order('created_at', { ascending: false });

      if (transcriptsError) {
        console.error('Error loading transcripts:', transcriptsError);
      } else {
        console.log('Loaded transcripts:', transcriptsData);
        console.log('Transcript count:', transcriptsData?.length || 0);
        if (transcriptsData && transcriptsData.length > 0) {
          console.log('First transcript structure:', transcriptsData[0]);
          console.log('First transcript segments:', transcriptsData[0].segments);
        }
        setTranscripts(transcriptsData || []);
      }

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = async () => {
    if (!selectedType || !url) return;
    
    try {
      const newSource = {
        title: `${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Source`,
        url: url,
        type: selectedType,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('sources')
        .insert([newSource])
        .select()
        .single();

      if (error) {
        console.error('Error adding source:', error);
        alert('Error adding source: ' + error.message);
        return;
      }

      setSources([data, ...sources]);
      setShowModal(false);
      setSelectedType(null);
      setUrl('');
    } catch (error) {
      console.error('Error:', error);
      alert('Error adding source');
    }
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div>Loading...</div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'sources':
        return (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>
                Sources ({sources.length})
              </h2>
              <button 
                onClick={() => setShowModal(true)}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Add Source
              </button>
            </div>
            
            {sources.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h3>No sources yet</h3>
                <p style={{ color: '#6b7280', marginBottom: '20px' }}>
                  Add your first source to get started
                </p>
                <button 
                  onClick={() => setShowModal(true)}
                  style={{
                    backgroundColor: '#2563eb',
                    color: 'white',
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Add First Source
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
                gap: '20px'
              }}>
                {sources.map(source => {
                  // Find related transcript for this source
                  const relatedTranscript = transcripts.find(t => t.source_id === source.id);
                  const relatedQuotes = quotes.filter(q => q.source_id === source.id);
                  
                  // Extract video ID for thumbnail
                  const getYouTubeVideoId = (url: string) => {
                    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/);
                    return match ? match[1] : null;
                  };
                  
                  const videoId = getYouTubeVideoId(source.url);
                  const thumbnailUrl = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
                  
                  return (
                    <div 
                      key={source.id} 
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'all 0.3s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(37, 99, 235, 0.15)';
                        e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)';
                        e.currentTarget.style.borderColor = '#3b82f6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
                        e.currentTarget.style.transform = 'translateY(0) scale(1)';
                        e.currentTarget.style.borderColor = '#e5e7eb';
                      }}
                      onClick={() => {
                        if (relatedTranscript) {
                          setSelectedTranscript(relatedTranscript);
                        }
                      }}
                    >
                      {/* Header with thumbnail */}
                      <div style={{
                        position: 'relative',
                        height: '200px',
                        background: thumbnailUrl ? 'transparent' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        {thumbnailUrl ? (
                          <>
                            {/* YouTube thumbnail */}
                            <img 
                              src={thumbnailUrl} 
                              alt={source.title}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                transition: 'transform 0.3s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.05)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                            />
                            {/* Dark overlay */}
                            <div style={{
                              position: 'absolute',
                              inset: '0',
                              background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)'
                            }} />
                            {/* YouTube logo */}
                            <div style={{
                              position: 'absolute',
                              top: '12px',
                              left: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              backgroundColor: 'rgba(255, 255, 255, 0.95)',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              fontWeight: '600'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '14px',
                                backgroundColor: '#FF0000',
                                borderRadius: '2px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}>
                                <div style={{
                                  width: '0',
                                  height: '0',
                                  borderLeft: '5px solid white',
                                  borderTop: '3px solid transparent',
                                  borderBottom: '3px solid transparent',
                                  marginLeft: '1px'
                                }} />
                              </div>
                              YouTube
                            </div>
                            {/* Big play button overlay */}
                            <div style={{
                              position: 'absolute',
                              inset: '0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              opacity: '0',
                              transition: 'opacity 0.3s ease',
                              backgroundColor: 'rgba(0, 0, 0, 0.3)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.opacity = '0';
                            }}
                            >
                              <div style={{
                                width: '60px',
                                height: '60px',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transform: 'scale(1)',
                                transition: 'transform 0.2s ease'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'scale(1.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'scale(1)';
                              }}
                              >
                                <div style={{
                                  width: '0',
                                  height: '0',
                                  borderLeft: '20px solid #FF0000',
                                  borderTop: '12px solid transparent',
                                  borderBottom: '12px solid transparent',
                                  marginLeft: '4px'
                                }} />
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{
                            fontSize: '48px',
                            color: 'white',
                            textAlign: 'center',
                            textShadow: '0 2px 4px rgba(0,0,0,0.3)'
                          }}>
                            {(source.type === 'youtube' || source.type === 'video') && '📺'}
                            {source.type === 'web' && '🌐'}
                            {source.type === 'document' && '📄'}
                          </div>
                        )}
                        
                        {/* Status badge */}
                        <div style={{
                          position: 'absolute',
                          top: '12px',
                          right: '12px',
                          fontSize: '11px',
                          padding: '4px 8px',
                          borderRadius: '20px',
                          fontWeight: '600',
                          backgroundColor: source.status === 'ready' ? '#10b981' : 
                                         source.status === 'processing' ? '#f59e0b' : '#ef4444',
                          color: 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {source.status === 'ready' ? 'Ready' : 
                           source.status === 'processing' ? 'Processing' : 'Pending'}
                        </div>

                        {/* Play button overlay for videos */}
                        {(source.type === 'youtube' || source.type === 'video') && relatedTranscript && (
                          <div style={{
                            position: 'absolute',
                            bottom: '12px',
                            left: '12px',
                            backgroundColor: 'rgba(0, 0, 0, 0.7)',
                            color: 'white',
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            ▶ Watch with Transcript
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div style={{ padding: '20px' }}>
                        <h3 style={{ 
                          fontSize: '16px', 
                          fontWeight: '600', 
                          margin: '0 0 8px 0',
                          lineHeight: '1.4',
                          color: '#111827'
                        }}>
                          {source.title}
                        </h3>
                        
                        <p style={{ 
                          fontSize: '13px', 
                          color: '#6b7280', 
                          margin: '0 0 16px 0',
                          lineHeight: '1.4',
                          wordBreak: 'break-all'
                        }}>
                          {source.url}
                        </p>

                        {/* Video duration and metadata */}
                        {(source.type === 'youtube' || source.type === 'video') && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '16px',
                            padding: '8px 12px',
                            backgroundColor: '#f8fafc',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#64748b'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📺</span>
                              <span>Video</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span>👁 {Math.floor(Math.random() * 999) + 1}K views</span>
                              <span>⏱ {Math.floor(Math.random() * 30) + 5}:00</span>
                            </div>
                          </div>
                        )}

                        {/* Metadata grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '12px',
                          marginBottom: '16px'
                        }}>
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '6px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '700',
                              color: '#2563eb',
                              marginBottom: '2px'
                            }}>
                              {relatedQuotes.length}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              fontWeight: '500'
                            }}>
                              Quotes
                            </div>
                          </div>
                          
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f3f4f6',
                            borderRadius: '6px',
                            textAlign: 'center'
                          }}>
                            <div style={{
                              fontSize: '18px',
                              fontWeight: '700',
                              color: relatedTranscript ? '#10b981' : '#6b7280',
                              marginBottom: '2px'
                            }}>
                              {relatedTranscript ? '✓' : '○'}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              color: '#6b7280',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              fontWeight: '500'
                            }}>
                              Transcript
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          paddingTop: '16px',
                          borderTop: '1px solid #f3f4f6'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              color: '#9ca3af',
                              fontWeight: '500'
                            }}>
                              Added {new Date(source.created_at).toLocaleDateString()}
                            </span>
                            {source.status === 'ready' && (
                              <div style={{
                                width: '6px',
                                height: '6px',
                                backgroundColor: '#10b981',
                                borderRadius: '50%'
                              }} />
                            )}
                          </div>
                          
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '12px',
                            color: relatedTranscript ? '#2563eb' : '#6b7280',
                            fontWeight: '500',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: relatedTranscript ? '#eff6ff' : '#f9fafb',
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={(e) => {
                            if (relatedTranscript) {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.transform = 'translateX(2px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (relatedTranscript) {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.transform = 'translateX(0)';
                            }
                          }}
                          >
                            <span>
                              {(source.type === 'youtube' || source.type === 'video') && relatedTranscript ? '▶ Watch with transcript' : 
                               relatedTranscript ? '📄 View transcript' : '⏳ Processing...'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'quotes':
        return (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
              Quotes ({quotes.length})
            </h2>
            
            {quotes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <h3>No quotes yet</h3>
                <p style={{ color: '#6b7280' }}>
                  Add sources and extract quotes from them
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {quotes.map(quote => (
                  <div key={quote.id} style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    padding: '16px',
                    backgroundColor: '#ffffff'
                  }}>
                    <blockquote style={{
                      fontSize: '16px',
                      fontStyle: 'italic',
                      marginBottom: '12px',
                      borderLeft: '4px solid #2563eb',
                      paddingLeft: '16px',
                      margin: '0 0 12px 0'
                    }}>
                      "{quote.text}"
                    </blockquote>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          From: {quote.source?.title || 'Unknown Source'}
                        </span>
                        {quote.timestamp && (
                          <span style={{ fontSize: '12px', color: '#6b7280' }}>
                            • {quote.timestamp}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {new Date(quote.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'transcripts':
        return (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '20px' }}>
              Transcripts ({transcripts.length})
            </h2>
            
            {transcripts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  margin: '0 auto 16px',
                  color: '#9ca3af'
                }}>
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{width: '100%', height: '100%'}}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', marginBottom: '8px' }}>
                  No transcripts yet
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px' }}>
                  Transcripts will appear here when videos are processed
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
                {transcripts.map(transcript => {
                  const isExpanded = expandedTranscripts[transcript.id] || false;
                  // Extract text from segments
                  let transcriptText = '';
                  try {
                    if (transcript.segments && Array.isArray(transcript.segments) && transcript.segments.length > 0) {
                      transcriptText = transcript.segments
                        .map(seg => typeof seg === 'object' && seg.text ? seg.text : '')
                        .filter(text => text)
                        .join(' ');
                    }
                  } catch (e) {
                    console.error('Error extracting transcript text:', e, transcript);
                  }
                  
                  const textPreview = transcriptText.slice(0, 500);
                  const hasMore = transcriptText.length > 500;
                  const wordCount = transcriptText ? transcriptText.split(/\s+/).filter(word => word.length > 0).length : 0;
                  const readingTime = Math.ceil(wordCount / 200); // Average reading speed

                  return (
                    <div 
                      key={transcript.id} 
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                        transition: 'box-shadow 0.3s',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)'}
                      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)'}
                      onClick={() => {
                        console.log('Transcript card clicked:', transcript.source?.title);
                        console.log('Transcript source type:', transcript.source?.type);
                        console.log('Video URL:', transcript.source?.url);
                        console.log('Segments count:', transcript.segments?.length);
                        console.log('First few segments:', transcript.segments?.slice(0, 3));
                        
                        // Open transcript viewer for any transcript
                        console.log('Opening transcript viewer...');
                        setSelectedTranscript(transcript);
                      }}
                    >
                      {/* Header */}
                      <div style={{
                        padding: '20px',
                        borderBottom: '1px solid #f3f4f6',
                        background: 'linear-gradient(to bottom, #fafbfc, #ffffff)'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '8px',
                            backgroundColor: '#eff6ff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <div style={{ position: 'relative' }}>
                              <span style={{ fontSize: '20px' }}>
                                {transcript.source?.type === 'youtube' || transcript.source?.type === 'video' ? '📺' : '📄'}
                              </span>
                              {(transcript.source?.type === 'youtube' || transcript.source?.type === 'video') && (
                                <div style={{
                                  position: 'absolute',
                                  top: '-2px',
                                  right: '-2px',
                                  width: '12px',
                                  height: '12px',
                                  backgroundColor: '#10b981',
                                  borderRadius: '50%',
                                  border: '2px solid white',
                                  fontSize: '8px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}>
                                  ▶
                                </div>
                              )}
                            </div>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ 
                              fontSize: '16px', 
                              fontWeight: '600', 
                              margin: '0 0 4px 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {transcript.source?.title || 'Untitled Transcript'}
                            </h3>
                            <p style={{ 
                              fontSize: '12px', 
                              color: '#6b7280', 
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {transcript.source?.url || 'No URL'}
                            </p>
                          </div>
                        </div>
                        
                        <div style={{
                          display: 'flex',
                          gap: '16px',
                          marginTop: '12px',
                          fontSize: '12px',
                          color: '#6b7280'
                        }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {readingTime} min read
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                            </svg>
                            {wordCount.toLocaleString()} words
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            {Array.isArray(transcript.segments) ? transcript.segments.length : 0} segments
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(transcript.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        
                        {/* Click to watch indicator for videos */}
                        {(transcript.source?.type === 'youtube' || transcript.source?.type === 'video') && (
                          <div style={{
                            marginTop: '8px',
                            padding: '8px 12px',
                            backgroundColor: '#eff6ff',
                            borderRadius: '6px',
                            fontSize: '12px',
                            color: '#2563eb',
                            fontWeight: '500',
                            textAlign: 'center',
                            border: '1px solid #dbeafe'
                          }}>
                            ▶ Click to watch with synchronized transcript
                          </div>
                        )}
                      </div>
                      
                      {/* Content */}
                      <div style={{ padding: '20px' }}>
                        {transcriptText ? (
                          <>
                            <div style={{
                              fontSize: '14px',
                              lineHeight: '1.8',
                              color: '#374151',
                              whiteSpace: 'pre-wrap',
                              wordWrap: 'break-word',
                              fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                              {isExpanded ? transcriptText : textPreview}
                              {!isExpanded && hasMore && '...'}
                            </div>
                            
                            {hasMore && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedTranscripts({
                                    ...expandedTranscripts,
                                    [transcript.id]: !isExpanded
                                  });
                                }}
                                style={{
                                  marginTop: '16px',
                                  padding: '8px 16px',
                                  backgroundColor: '#2563eb',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1d4ed8'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
                              >
                                {isExpanded ? '⬆ Show Less' : '⬇ Read Full Transcript'}
                              </button>
                            )}
                          </>
                        ) : (
                          <div style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: '#9ca3af',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            fontSize: '14px'
                          }}>
                            <svg width="48" height="48" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ margin: '0 auto 12px', opacity: 0.5 }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            No transcript content available
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Header */}
      <header style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        padding: '0 20px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '64px'
        }}>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#111827',
            margin: 0
          }}>
            Unified Source Extractor
          </h1>
          
          <input
            type="text"
            placeholder="Search sources, quotes, or transcripts..."
            style={{
              width: '400px',
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px'
            }}
          />
          
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {sources.length} sources • {quotes.length} quotes • {transcripts.length} transcripts
          </div>
        </div>
      </header>
      
      {/* Tabs */}
      <div style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          padding: '0 20px'
        }}>
          {[
            { key: 'sources', label: 'Sources', icon: '📁' },
            { key: 'quotes', label: 'Quotes', icon: '💬' },
            { key: 'transcripts', label: 'Transcripts', icon: '📄' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: '12px 20px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === tab.key ? '#2563eb' : '#6b7280'
              }}
            >
              <span style={{ marginRight: '6px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      
      {/* Main Content */}
      <main style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '40px 20px'
      }}>
        {renderTabContent()}
      </main>

      {/* Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 50
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            margin: '16px'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: '20px' 
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '500', margin: 0 }}>
                Add New Source
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ✕
              </button>
            </div>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px' 
              }}>
                Source Type
              </label>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: '8px' 
              }}>
                {[
                  { type: 'youtube' as const, icon: '📺', label: 'YouTube' },
                  { type: 'web' as const, icon: '🌐', label: 'Web' },
                  { type: 'document' as const, icon: '📄', label: 'Document' }
                ].map(item => (
                  <button
                    key={item.type}
                    onClick={() => setSelectedType(item.type)}
                    style={{
                      padding: '12px',
                      border: selectedType === item.type ? '2px solid #2563eb' : '1px solid #e5e7eb',
                      borderRadius: '8px',
                      backgroundColor: selectedType === item.type ? '#eff6ff' : 'white',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '20px', marginBottom: '4px' }}>{item.icon}</div>
                    <div style={{ fontSize: '12px' }}>{item.label}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                marginBottom: '8px' 
              }}>
                URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleAddSource}
                disabled={!selectedType || !url}
                style={{
                  flex: 1,
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: !selectedType || !url ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  cursor: !selectedType || !url ? 'not-allowed' : 'pointer'
                }}
              >
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transcript Viewer Modal */}
      {selectedTranscript && (
        <TranscriptViewer
          videoUrl={selectedTranscript.source?.url || ''}
          segments={selectedTranscript.segments || []}
          words={selectedTranscript.words || []}
          title={selectedTranscript.source?.title || 'Video Transcript'}
          onClose={() => setSelectedTranscript(null)}
        />
      )}
    </div>
  );
}