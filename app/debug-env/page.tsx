"use client";

import { useEffect, useState } from 'react';

export default function DebugEnvPage() {
  const [envInfo, setEnvInfo] = useState<any>(null);

  useEffect(() => {
    // Check client-side environment variables
    const info = {
      clientSide: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'MISSING',
        NODE_ENV: process.env.NODE_ENV,
      },
      windowEnv: typeof window !== 'undefined' ? {
        // @ts-ignore
        NEXT_PUBLIC_SUPABASE_URL: window.__ENV?.NEXT_PUBLIC_SUPABASE_URL || 'NOT_IN_WINDOW',
        // @ts-ignore  
        NEXT_PUBLIC_SUPABASE_ANON_KEY: window.__ENV?.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'NOT_IN_WINDOW',
      } : null
    };
    
    setEnvInfo(info);
  }, []);

  const fetchServerEnv = async () => {
    try {
      const response = await fetch('/api/debug-env');
      const data = await response.json();
      setEnvInfo(prev => ({ ...prev, serverSide: data }));
    } catch (error) {
      console.error('Failed to fetch server env:', error);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Debug</h1>
      
      <button 
        onClick={fetchServerEnv}
        className="mb-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Fetch Server-Side Env
      </button>
      
      <div className="space-y-4">
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-semibold mb-2">Client-Side Environment</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(envInfo?.clientSide, null, 2)}
          </pre>
        </div>
        
        {envInfo?.windowEnv && (
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Window Environment</h2>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(envInfo.windowEnv, null, 2)}
            </pre>
          </div>
        )}
        
        {envInfo?.serverSide && (
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="font-semibold mb-2">Server-Side Environment</h2>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(envInfo.serverSide, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}