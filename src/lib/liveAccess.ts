import { supabase } from '@/src/lib/supabaseClient';

export type LiveAccess = {
  active: boolean;
  plan: string | null;
  status: string | null;
  classesRemaining: number | null;
  lastClassWarning: boolean;
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

function normalizeClassDay(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export async function getLiveAccessByEmail(email?: string | null): Promise<LiveAccess> {
  if (!email) {
    return {
      active: false,
      plan: null,
      status: null,
      classesRemaining: null,
      lastClassWarning: false,
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
      const firstAnchor = accessRows[0]?.start_date || accessRows[0]?.created_at || null;

      if (firstAnchor) {
        const { data: classRows, error: classRowsError } = await supabase
          .from('class_videos')
          .select('starts_at,kind')
          .eq('kind', 'live')
          .not('starts_at', 'is', null)
          .gte('starts_at', firstAnchor)
          .order('starts_at', { ascending: true });

        if (!classRowsError) {
          const uniqueClassDays: string[] = [];

          for (const row of classRows || []) {
            const normalizedDay = row?.starts_at ? normalizeClassDay(row.starts_at) : null;
            if (!normalizedDay) continue;
            if (!uniqueClassDays.includes(normalizedDay)) {
              uniqueClassDays.push(normalizedDay);
            }
          }

          const packages = accessRows.map((row) => ({
            ...row,
            anchorDay: normalizeClassDay(String(row.start_date || row.created_at || '')) || '',
            total: Number(row.total_classes || 0),
            consumed: 0,
          }));

          // Restar una clase por cada día de clase impartida, consumiendo primero los paquetes más antiguos.
          for (const classDay of uniqueClassDays) {
            const targetPackage = packages.find(
              (pkg) => pkg.anchorDay && pkg.anchorDay <= classDay && pkg.consumed < pkg.total
            );

            if (targetPackage) {
              targetPackage.consumed += 1;
            }
          }

          const remainingClasses = packages.reduce(
            (sum, pkg) => sum + Math.max(pkg.total - pkg.consumed, 0),
            0
          );

          const latestPackage = packages[packages.length - 1] || null;

          return {
            active: remainingClasses > 0,
            plan: latestPackage?.plan_name ?? 'LIVE_CLASS',
            status: remainingClasses > 0 ? 'active' : 'inactive',
            classesRemaining: remainingClasses,
            lastClassWarning: remainingClasses === 1,
          };
        }

        console.error('[live access] class_videos check error:', classRowsError.message);
      }

      // Fallback si no se puede consultar class_videos
      const remainingClasses = accessRows.reduce((sum, row) => {
        const total = Number(row.total_classes || 0);
        const used = Number(row.classes_used || 0);
        return sum + Math.max(total - used, 0);
      }, 0);

      const latestRow = accessRows[accessRows.length - 1] || null;

      return {
        active: remainingClasses > 0,
        plan: latestRow?.plan_name ?? 'LIVE_CLASS',
        status: remainingClasses > 0 ? 'active' : 'inactive',
        classesRemaining: remainingClasses,
        lastClassWarning: remainingClasses === 1,
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
  };
}
