'use client';

import { useState, useEffect } from 'react';

interface TranscriptSummary {
  id: string;
  sourceId: string;
  createdAt: string;
  updatedAt: string;
  segmentsCount: number;
  wordsCount: number;
  speakersCount: number;
  speakers: string[];
  firstSegment: string;
}

interface TranscriptsResponse {
  success: boolean;
  count: number;
  transcripts: TranscriptSummary[];
  error?: string;
}

export default function AdminPage() {
  const [transcripts, setTranscripts] = useState<TranscriptSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchTranscripts = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/transcripts');
      const data: TranscriptsResponse = await response.json();
      
      if (data.success) {
        setTranscripts(data.transcripts);
      } else {
        setError(data.error || 'Failed to load transcripts');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const deleteTranscript = async (transcriptId: string, sourceId: string) => {
    if (!confirm(`¿Estás seguro de que quieres borrar el transcript ${sourceId}?`)) {
      return;
    }
    
    try {
      setDeleting(transcriptId);
      
      const response = await fetch(`/api/admin/transcripts?id=${transcriptId}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTranscripts(prev => prev.filter(t => t.id !== transcriptId));
        alert('Transcript borrado exitosamente');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDeleting(null);
    }
  };

  const cleanupAll = async () => {
    const confirmation = prompt('Para borrar TODOS los transcripts, escribe: YES_DELETE_ALL');
    if (confirmation !== 'YES_DELETE_ALL') {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/admin/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup', confirm: 'YES_DELETE_ALL' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setTranscripts([]);
        alert(`Limpieza completa: ${data.deletedCounts.transcripts} transcripts borrados`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranscripts();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Database Admin</h1>
          <div className="bg-white rounded-lg shadow p-6">
            <p>Cargando transcripts...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Database Admin</h1>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800">Error: {error}</p>
            <button 
              onClick={fetchTranscripts}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Database Admin</h1>
          <div className="space-x-4">
            <button 
              onClick={fetchTranscripts}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refrescar
            </button>
            <button 
              onClick={cleanupAll}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Borrar Todo
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">Resumen</h2>
          <p className="text-gray-600">
            Total de transcripts en la database: <span className="font-bold">{transcripts.length}</span>
          </p>
          <p className="text-gray-600">
            Total de segmentos: <span className="font-bold">{transcripts.reduce((sum, t) => sum + t.segmentsCount, 0)}</span>
          </p>
          <p className="text-gray-600">
            Total de palabras: <span className="font-bold">{transcripts.reduce((sum, t) => sum + t.wordsCount, 0)}</span>
          </p>
        </div>

        {transcripts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-500">No hay transcripts en la database</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transcripts.map((transcript) => (
              <div key={transcript.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Source ID: {transcript.sourceId}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      Creado: {new Date(transcript.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      Actualizado: {new Date(transcript.updatedAt).toLocaleString()}
                    </p>
                    <div className="flex space-x-4 text-sm text-gray-600 mb-3">
                      <span>{transcript.segmentsCount} segmentos</span>
                      <span>{transcript.wordsCount} palabras</span>
                      <span>{transcript.speakersCount} speakers</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      Speakers: {transcript.speakers.join(', ') || 'Ninguno'}
                    </p>
                    <p className="text-sm text-gray-700 bg-gray-50 p-2 rounded">
                      {transcript.firstSegment}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteTranscript(transcript.id, transcript.sourceId)}
                    disabled={deleting === transcript.id}
                    className={`ml-4 px-4 py-2 rounded text-white ${
                      deleting === transcript.id 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {deleting === transcript.id ? 'Borrando...' : 'Borrar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}