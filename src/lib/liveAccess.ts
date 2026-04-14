import { supabase } from '@/src/lib/supabaseClient';

export type LiveAccess = {
  active: boolean;
  plan: string | null;
  status: string | null;
  classesRemaining: number | null;
  lastClassWarning: boolean;
  accessStartAt: string | null;
};

type AccessRow = {
  id: string;
  plan_name: string | null;
  total_classes: number | null;
  classes_used: number | null;
  active: boolean | null;
  start_date: string | null;
  last_class_date: string | null;
  created_at: string | null;
};

export async function getLiveAccessByEmail(email?: string | null): Promise<LiveAccess> {
  if (!email) {
    return {
      active: false,
      plan: null,
      status: null,
      classesRemaining: null,
      lastClassWarning: false,
      accessStartAt: null,
    };
  }

  const normalizedEmail = email.toLowerCase();

  const { data: classAccessRows, error: classAccessError } = await supabase
    .from('user_class_access')
    .select('id,plan_name,total_classes,classes_used,active,start_date,last_class_date,created_at')
    .eq('email', normalizedEmail)
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (!classAccessError) {
    const accessRows = (Array.isArray(classAccessRows) ? classAccessRows : []) as AccessRow[];

    if (accessRows.length > 0) {
      const remainingClasses = accessRows.reduce((sum, row) => {
        const total = Number(row.total_classes || 0);
        const used = Number(row.classes_used || 0);
        return sum + Math.max(total - used, 0);
      }, 0);

      const latestRow = accessRows[accessRows.length - 1] || null;
      const firstRow = accessRows[0] || null;
      const accessStartAt = firstRow?.start_date || firstRow?.created_at || null;

      const now = new Date();
      const startDate = accessStartAt ? new Date(accessStartAt) : null;
      const isStarted = startDate ? now >= startDate : true;

      return {
        active: remainingClasses > 0 && isStarted,
        plan: latestRow?.plan_name ?? 'LIVE_CLASS',
        status: remainingClasses > 0 && isStarted ? 'active' : 'inactive',
        classesRemaining: remainingClasses,
        lastClassWarning: remainingClasses === 1 && isStarted,
        accessStartAt,
      };
    }
  } else {
    console.error('[live access] user_class_access check error:', classAccessError.message);
  }

  const { data, error } = await supabase
    .from('entitlements')
    .select('plan,status,level')
    .eq('user_email', normalizedEmail)
    .eq('plan', 'LIVE_CLASS')
    .eq('status', 'active')
    .limit(1);

  if (error) {
    console.error('[live access] entitlement check error:', error.message);
    return {
      active: false,
      plan: null,
      status: null,
      classesRemaining: null,
      lastClassWarning: false,
      accessStartAt: null,
    };
  }

  const row = Array.isArray(data) && data.length > 0 ? data[0] : null;

  const fallbackTotal =
    row?.level === 'WEEKLY'
      ? 5
      : row?.level === 'TWO_WEEKS'
      ? 10
      : row?.level === 'FOUR_WEEKS'
      ? 20
      : null;

  return {
    active: Boolean(row),
    plan: row?.level ?? row?.plan ?? null,
    status: row?.status ?? null,
    classesRemaining: fallbackTotal,
    lastClassWarning: false,
    accessStartAt: null,
  };
}
