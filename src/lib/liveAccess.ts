import { supabase } from '@/src/lib/supabaseClient';

export type LiveAccess = {
  active: boolean;
  plan: string | null;
  status: string | null;
};

export async function getLiveAccessByEmail(email?: string | null): Promise<LiveAccess> {
  if (!email) return { active: false, plan: null, status: null };

  const { data, error } = await supabase
    .from('entitlements')
    .select('plan,status')
    .eq('user_email', email.toLowerCase())
    .eq('plan', 'LIVE_CLASS')
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('[live access] entitlement check error:', error.message);
    return { active: false, plan: null, status: null };
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
  return { active: Boolean(row), plan: row?.plan ?? null, status: row?.status ?? null };
}
