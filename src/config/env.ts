// Environment configuration for React Native app
import Constants from 'expo-constants';

export const config = {
  API_BASE_URL: Constants.expoConfig?.extra?.apiBaseUrl || process.env.EXPO_PUBLIC_API_BASE_URL || 'https://idms-do.icsafrica-sp.org/api/v1',
  SUPABASE_URL: Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL,
  SUPABASE_ANON_KEY: Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  NODE_ENV: __DEV__ ? 'development' : 'production',
} as const;

// Validate required environment variables
if (!config.API_BASE_URL) {
  console.error('API Base URL is missing. Please check your environment variables.');
  throw new Error('API_BASE_URL environment variable is not set.');
}

export default config;

