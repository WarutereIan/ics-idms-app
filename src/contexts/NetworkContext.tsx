import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { initializeDatabase } from '@/services/offlineStorage';
import { syncService } from '@/services/syncService';

interface NetworkContextType {
  isOnline: boolean;
  isConnected: boolean;
  connectionType: string | null;
  isSyncing: boolean;
  syncError: string | null;
  sync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextType | undefined>(undefined);

interface NetworkProviderProps {
  children: ReactNode;
}

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Initialize database on mount
  useEffect(() => {
    initializeDatabase().catch((error) => {
      console.error('Failed to initialize database:', error);
    });
  }, []);

  // Monitor network state
  useEffect(() => {
    // Get initial state
    NetInfo.fetch().then((state) => {
      setIsOnline(state.isConnected ?? false);
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);
    });

    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected ?? false;
      setIsOnline(connected);
      setIsConnected(connected);
      setConnectionType(state.type);

      // Auto-sync when coming back online will be handled by the sync function
      // This is optional and can be disabled in settings later
    });

    return () => {
      unsubscribe();
    };
  }, [isSyncing]);

  const sync = async () => {
    if (!isConnected || isSyncing) {
      return;
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await syncService.syncReadyToSendResponses();
      
      if (!result.success || result.failedCount > 0) {
        const errorMessage = result.errors.length > 0
          ? result.errors.map(e => `${e.error}`).join('; ')
          : `Failed to sync ${result.failedCount} item(s)`;
        setSyncError(errorMessage);
        throw new Error(errorMessage);
      }
      
      // Only clear error if sync was completely successful
      if (result.syncedCount === 0 && result.failedCount === 0) {
        // No items to sync is not an error
        setSyncError(null);
      }
    } catch (error) {
      console.error('Sync error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      throw error; // Re-throw so callers can handle it
    } finally {
      setIsSyncing(false);
    }
  };

  const value: NetworkContextType = {
    isOnline,
    isConnected,
    connectionType,
    isSyncing,
    syncError,
    sync,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork(): NetworkContextType {
  const context = useContext(NetworkContext);
  if (context === undefined) {
    throw new Error('useNetwork must be used within a NetworkProvider');
  }
  return context;
}

