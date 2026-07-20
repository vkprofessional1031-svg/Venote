import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Ensure they are set in .env.local');
}

const customStorage = {
  getItem: (key: string) => {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(key) || window.localStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (typeof window === 'undefined') return;
    if (window.sessionStorage.getItem('useSessionStorageAuth') === 'true') {
      window.sessionStorage.setItem(key, value);
    } else {
      window.localStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? customStorage : undefined,
  }
});
