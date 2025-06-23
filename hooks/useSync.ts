import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export function useSync() {
  const { loadFromDatabase, syncToDatabase, setOnlineStatus, isOnline, lastSyncTime } = useStore()

  useEffect(() => {
    // Load data from database on mount
    const loadInitialData = async () => {
      try {
        await loadFromDatabase()
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }

    loadInitialData()
  }, [loadFromDatabase])

  useEffect(() => {
    // Handle online/offline status
    const handleOnline = () => {
      setOnlineStatus(true)
      // Sync when coming back online
      syncToDatabase()
    }

    const handleOffline = () => {
      setOnlineStatus(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setOnlineStatus, syncToDatabase])

  useEffect(() => {
    // Auto-sync every 5 minutes if online
    const interval = setInterval(() => {
      if (isOnline) {
        syncToDatabase()
      }
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [isOnline, syncToDatabase])

  useEffect(() => {
    // Sync before page unload
    const handleBeforeUnload = () => {
      if (isOnline) {
        // Use sendBeacon for reliable sync on page unload
        navigator.sendBeacon('/api/sync', JSON.stringify({ 
          type: 'sync',
          timestamp: Date.now() 
        }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isOnline])

  return {
    isOnline,
    lastSyncTime,
    manualSync: syncToDatabase,
    lastSyncText: lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never'
  }
}