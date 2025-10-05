import { supabase } from './supabase';

export async function testSupabaseConnection(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    const { data, error } = await supabase.from('profiles').select('count').limit(1);

    if (error) {
      console.error('Supabase connection test failed:', error);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
        details: error,
      };
    }

    return {
      success: true,
      message: 'Connected successfully to Supabase',
      details: data,
    };
  } catch (error: any) {
    console.error('Supabase connection test error:', error);
    return {
      success: false,
      message: `Connection error: ${error?.message || 'Unknown error'}`,
      details: error,
    };
  }
}
