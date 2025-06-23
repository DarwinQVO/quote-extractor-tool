"use client";

import { Cloud, CloudOff, RefreshCw, Wifi, WifiOff, Database, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSync } from "@/hooks/useSync";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function SyncIndicator() {
  const { isOnline, lastSyncText, manualSync } = useSync();
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'connected' | 'disconnected' | 'testing'>('testing');
  const [dbError, setDbError] = useState<string | null>(null);

  // Test database connection
  useEffect(() => {
    const testConnection = async () => {
      try {
        setDbStatus('testing');
        setDbError(null);
        
        // Simple query to test connection
        const { error } = await supabase
          .from('sources')
          .select('count')
          .limit(1);
        
        if (error) {
          throw error;
        }
        
        setDbStatus('connected');
        console.log('✅ Database connection successful');
      } catch (error) {
        setDbStatus('disconnected');
        setDbError(error instanceof Error ? error.message : 'Unknown error');
        console.error('❌ Database connection failed:', error);
      }
    };

    testConnection();
    
    // Test connection every 30 seconds
    const interval = setInterval(testConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await manualSync();
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {/* Connection status panel */}
      <div className="flex items-center gap-2">
        {/* Internet status */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
          isOnline 
            ? 'bg-green-100 text-green-800 border border-green-200' 
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="w-3 h-3" />
              Internet
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3" />
              No Internet
            </>
          )}
        </div>

        {/* Database status */}
        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
          dbStatus === 'connected' 
            ? 'bg-blue-100 text-blue-800 border border-blue-200'
            : dbStatus === 'disconnected'
            ? 'bg-red-100 text-red-800 border border-red-200'
            : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
        }`} title={dbError || 'Database connection status'}>
          {dbStatus === 'testing' ? (
            <>
              <RefreshCw className="w-3 h-3 animate-spin" />
              Testing DB
            </>
          ) : dbStatus === 'connected' ? (
            <>
              <Database className="w-3 h-3" />
              DB Connected
            </>
          ) : (
            <>
              <AlertCircle className="w-3 h-3" />
              DB Error
            </>
          )}
        </div>

        {/* Sync button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleManualSync}
          disabled={!isOnline || dbStatus !== 'connected' || isSyncing}
          className="h-7 px-2 text-xs"
          title={`Last sync: ${lastSyncText}${dbError ? `\nDB Error: ${dbError}` : ''}`}
        >
          {isSyncing ? (
            <RefreshCw className="w-3 h-3 animate-spin" />
          ) : isOnline && dbStatus === 'connected' ? (
            <Cloud className="w-3 h-3" />
          ) : (
            <CloudOff className="w-3 h-3" />
          )}
          <span className="ml-1">
            {isSyncing ? 'Syncing...' : 'Sync'}
          </span>
        </Button>
      </div>

      {/* Error details (if any) */}
      {dbError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700 max-w-xs">
          <div className="font-medium">Database Error:</div>
          <div className="mt-1 break-words">{dbError}</div>
        </div>
      )}
    </div>
  );
}