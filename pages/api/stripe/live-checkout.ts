import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/src/lib/stripe';

const PRICE_KEYS: Record<string, string | undefined> = {
  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY:
    process.env.STRIPE_PRICE_WEEKLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_WEEKLY,

  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS:
    process.env.STRIPE_PRICE_TWO_WEEKS || process.env.NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS,

  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS:
    process.env.STRIPE_PRICE_FOUR_WEEKS || process.env.NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS,

  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME:
    process.env.STRIPE_PRICE_WEEKLY_ONE_TIME || process.env.NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME,

  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME:
    process.env.STRIPE_PRICE_TWO_WEEKS_ONE_TIME || process.env.NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME,

  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME:
    process.env.STRIPE_PRICE_FOUR_WEEKS_ONE_TIME || process.env.NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME,

  NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME:
    process.env.STRIPE_PRICE_INTENSIVE_ONE_TIME || process.env.NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME,
};

const PLAN_META: Record<string, string> = {
  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY: 'WEEKLY',
  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS: 'TWO_WEEKS',
  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS: 'FOUR_WEEKS',
  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY_ONE_TIME: 'WEEKLY',
  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS_ONE_TIME: 'TWO_WEEKS',
  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS_ONE_TIME: 'FOUR_WEEKS',
  NEXT_PUBLIC_STRIPE_PRICE_INTENSIVE_ONE_TIME: 'INTENSIVE_TWO_DAY',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceKey, userEmail, purchaseType, acceptedTerms, levelOverride, classesOverride } = req.body || {};

    const normalizedPurchaseType =
      String(purchaseType || '').toLowerCase() === 'subscription'
        ? 'subscription'
        : 'one_time';

    const priceId = PRICE_KEYS[String(priceKey || '')];

    if (!priceId) {
      return res.status(400).json({
        error: `Price ID no configurado para: ${priceKey}. Verifica variables en Vercel.`,
      });
    }

    const normalizedEmail = String(userEmail || '').trim().toLowerCase();
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'No se recibió el correo del usuario.' });
    }

    if (!acceptedTerms) {
      return res.status(400).json({
        error: 'Debes aceptar los términos y condiciones antes de continuar.',
      });
    }

    const origin =
      req.headers.origin ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const sharedMetadata = {
      product: 'LIVE_CLASS',
      plan: 'LIVE_CLASS',
      level: String(levelOverride || PLAN_META[String(priceKey)] || 'LIVE').toUpperCase(),
      user_email: normalizedEmail,
      purchase_type: normalizedPurchaseType,
      classes_override: String(Number(classesOverride || 0) || ''),
    };

    const session = await stripe.checkout.sessions.create({
      mode: normalizedPurchaseType === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?paid=1`,
      cancel_url: `${origin}/dashboard?canceled=1`,
      allow_promotion_codes: true,
      customer_email: normalizedEmail,
      metadata: sharedMetadata,
      ...(normalizedPurchaseType === 'subscription'
        ? {
            subscription_data: {
              metadata: sharedMetadata,
            },
          }
        : {}),
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[live-checkout] error', error);
    return res.status(500).json({
      error: error?.message || 'No se pudo iniciar el checkout.',
    });
  }
}
