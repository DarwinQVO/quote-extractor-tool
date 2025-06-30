"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DebugUI() {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        .limit(3);

      if (error) {
        console.error('Error:', error);
      } else {
        console.log('Transcripts loaded:', data);
        setTranscripts(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', fontSize: '18px' }}>
        🔄 Loading transcripts...
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        🎯 Debug UI - Simple Transcript Cards
      </h1>
      
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Found {transcripts.length} transcripts
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {transcripts.map((transcript, index) => {
          // Extract text from segments
          let transcriptText = '';
          if (transcript.segments && Array.isArray(transcript.segments)) {
            transcriptText = transcript.segments
              .slice(0, 5) // First 5 segments only
              .map((seg: any) => seg.text || '')
              .join(' ');
          }

          return (
            <div 
              key={transcript.id}
              style={{
                border: '2px solid #007acc',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#f0f8ff',
                maxWidth: '800px'
              }}
            >
              <h2 style={{ 
                fontSize: '18px', 
                color: '#007acc',
                marginBottom: '10px'
              }}>
                📺 Transcript {index + 1}
              </h2>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>Title:</strong> {transcript.source?.title || 'No title'}
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>URL:</strong> {transcript.source?.url || 'No URL'}
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>Type:</strong> {transcript.source?.type || 'Unknown'}
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>Segments:</strong> {transcript.segments?.length || 0}
              </div>

              <div style={{
                backgroundColor: '#ffffff',
                padding: '15px',
                borderRadius: '4px',
                border: '1px solid #ddd'
              }}>
                <strong>Preview:</strong><br />
                {transcriptText || 'No text available'}
              </div>

              <button
                onClick={() => {
                  alert(`Would open transcript viewer for: ${transcript.source?.title}`);
                }}
                style={{
                  marginTop: '15px',
                  padding: '10px 20px',
                  backgroundColor: '#007acc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🎬 Open Video + Transcript
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '40px' }}>
        <a 
          href="/"
          style={{
            padding: '10px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '4px'
          }}
        >
          ← Back to Main App
        </a>
      </div>
    </div>
  );
}