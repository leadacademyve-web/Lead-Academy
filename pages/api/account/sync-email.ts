import type { NextApiRequest, NextApiResponse } from 'next';
import { createServerClient } from '@/src/lib/supabaseAdmin';

function normalizeEmail(value?: string | null) {
  return String(value || '').trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token.' });
    }

    const supabase = createServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid user session.' });
    }

    const currentEmail = normalizeEmail(user.email);
    const requestedNewEmail = normalizeEmail(req.body?.newEmail);

    if (!currentEmail) {
      return res.status(400).json({ error: 'Current user email not found.' });
    }

    if (!requestedNewEmail) {
      return res.status(400).json({ error: 'New email is required.' });
    }

    if (requestedNewEmail === currentEmail) {
      return res.status(200).json({ copied: 0 });
    }

    const { data: existingRows, error: loadError } = await supabase
      .from('entitlements')
      .select('plan,level,status,provider,last_event_id')
      .eq('user_email', currentEmail);

    if (loadError) throw loadError;

    if (!existingRows?.length) {
      return res.status(200).json({ copied: 0 });
    }

    const payload = existingRows.map((row) => ({
      user_email: requestedNewEmail,
      plan: row.plan,
      level: row.level,
      status: row.status,
      provider: row.provider,
      last_event_id: row.last_event_id,
    }));

    const { error: upsertError } = await supabase
      .from('entitlements')
      .upsert(payload, { onConflict: 'user_email,plan,level' });

    if (upsertError) throw upsertError;

    return res.status(200).json({ copied: payload.length });
  } catch (error: any) {
    console.error('[sync-email] error', error);
    return res.status(500).json({ error: error?.message || 'Unable to sync access.' });
  }
}
