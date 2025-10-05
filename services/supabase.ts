import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://0ec90b57d6e95fcbda19832f.supabase.co';

const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJib2x0IiwicmVmIjoiMGVjOTBiNTdkNmU5NWZjYmRhMTk4MzJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4ODE1NzQsImV4cCI6MTc1ODg4MTU3NH0.9I8-U0x86Ak8t2DGaIk0HfvTSLsAyzdnz-Nw00mMkKw';

console.log('Supabase Configuration:', {
  url: supabaseUrl,
  keyPrefix: supabaseAnonKey.substring(0, 20) + '...',
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  phone_number?: string;
  username: string;
  identity_key_public?: string;
  signed_prekey?: any;
  one_time_prekeys?: any[];
  last_active: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  message_type: string;
  status: 'sent' | 'delivered' | 'read';
  attachment_url?: string;
  attachment_type?: 'image' | 'video' | 'gif' | 'file';
  attachment_size?: number;
  attachment_name?: string;
  expires_at?: string;
  expire_duration?: number;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  last_message_at: string;
  created_at: string;
};
