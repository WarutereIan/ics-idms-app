import { createClient } from '@supabase/supabase-js';
import { config } from '@/config/env';
import type { Database } from '@/types/supabase';

export const supabase = createClient<Database>(config.SUPABASE_URL, config.SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: async (key: string) => {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        return await AsyncStorage.default.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        return await AsyncStorage.default.setItem(key, value);
      },
      removeItem: async (key: string) => {
        const AsyncStorage = await import('@react-native-async-storage/async-storage');
        return await AsyncStorage.default.removeItem(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper functions
export const getSupabaseSession = async () => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error getting Supabase session:', error);
    return null;
  }
  return data.session;
};

export const getSupabaseUser = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    console.error('Error getting Supabase user:', error);
    return null;
  }
  return data.user;
};

