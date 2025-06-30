"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function DebugTranscripts() {
  const [transcripts, setTranscripts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTranscripts();
  }, []);

  const loadTranscripts = async () => {
    try {
      // Load transcripts with source info
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          *,
          source:sources(*)
        `)
        .limit(5);

      if (error) {
        setError(error.message);
        console.error('Error:', error);
      } else {
        console.log('Raw transcript data:', data);
        setTranscripts(data || []);
      }
    } catch (err) {
      setError(String(err));
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Debug Transcripts</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <strong>Total transcripts found: {transcripts.length}</strong>
      </div>

      {transcripts.map((transcript, index) => (
        <div key={transcript.id} style={{
          marginBottom: '40px',
          padding: '20px',
          border: '1px solid #ccc',
          borderRadius: '8px',
          backgroundColor: '#f9f9f9'
        }}>
          <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>
            Transcript {index + 1} - {transcript.source?.title || 'No title'}
          </h2>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>ID:</strong> {transcript.id}
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Source ID:</strong> {transcript.source_id}
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Created:</strong> {new Date(transcript.created_at).toLocaleString()}
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Keys in transcript object:</strong>
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto'
            }}>
              {JSON.stringify(Object.keys(transcript), null, 2)}
            </pre>
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Has 'text' field:</strong> {transcript.text ? 'YES' : 'NO'}
          </div>
          
          <div style={{ marginBottom: '10px' }}>
            <strong>Has 'segments' field:</strong> {transcript.segments ? 'YES' : 'NO'}
          </div>
          
          {transcript.text && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Text preview (first 200 chars):</strong>
              <pre style={{ 
                backgroundColor: '#fff', 
                padding: '10px', 
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordWrap: 'break-word'
              }}>
                {transcript.text.substring(0, 200)}...
              </pre>
            </div>
          )}
          
          {transcript.segments && (
            <div style={{ marginBottom: '10px' }}>
              <strong>Segments count:</strong> {transcript.segments.length}
              <br />
              <strong>First segment:</strong>
              <pre style={{ 
                backgroundColor: '#fff', 
                padding: '10px', 
                borderRadius: '4px',
                overflow: 'auto'
              }}>
                {JSON.stringify(transcript.segments[0], null, 2)}
              </pre>
            </div>
          )}
          
          <details>
            <summary style={{ cursor: 'pointer', marginBottom: '10px' }}>
              <strong>Full transcript object (click to expand)</strong>
            </summary>
            <pre style={{ 
              backgroundColor: '#fff', 
              padding: '10px', 
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '300px'
            }}>
              {JSON.stringify(transcript, null, 2)}
            </pre>
          </details>
        </div>
      ))}
      
      {transcripts.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
          No transcripts found in the database
        </div>
      )}
    </div>
  );
}