import { supabase } from '@/src/lib/supabaseClient';

const STORAGE_KEY = 'lead_active_session_token';

function createToken() {
  const randomPart =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${Date.now()}_${Math.random().toString(36).slice(2)}_${randomPart}`;
}

export function getLocalSessionToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY) || '';
}

export function clearLocalSessionToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function registerSingleSession(userId: string) {
  const token = createToken();

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, token);
  }

  const { error } = await supabase.from('active_sessions').upsert({
    user_id: userId,
    session_token: token,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;

  return token;
}

export async function validateSingleSession(userId: string) {
  const localToken = getLocalSessionToken();
  if (!localToken) return false;

  const { data, error } = await supabase
    .from('active_sessions')
    .select('session_token')
    .eq('user_id', userId)
    .single();

  if (error || !data) return false;

  return data.session_token === localToken;
}
