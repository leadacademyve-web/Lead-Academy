import type { NextApiRequest, NextApiResponse } from 'next';
import { stripe } from '@/src/lib/stripe';

const PRICE_KEYS: Record<string, string | undefined> = {
  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY: process.env.STRIPE_PRICE_WEEKLY || process.env.NEXT_PUBLIC_STRIPE_PRICE_WEEKLY,
  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS: process.env.STRIPE_PRICE_TWO_WEEKS || process.env.NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS,
  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS: process.env.STRIPE_PRICE_FOUR_WEEKS || process.env.NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS,
};

const PLAN_META: Record<string, string> = {
  NEXT_PUBLIC_STRIPE_PRICE_WEEKLY: 'WEEKLY',
  NEXT_PUBLIC_STRIPE_PRICE_TWO_WEEKS: 'TWO_WEEKS',
  NEXT_PUBLIC_STRIPE_PRICE_FOUR_WEEKS: 'FOUR_WEEKS',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceKey } = req.body || {};
    const priceId = PRICE_KEYS[String(priceKey || '')];
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID no configurado para ese plan.' });
    }

    const origin = req.headers.origin || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?paid=1`,
      cancel_url: `${origin}/dashboard?canceled=1`,
      allow_promotion_codes: true,
      metadata: {
        product: 'LIVE_CLASS',
        plan: 'LIVE_CLASS',
        level: PLAN_META[String(priceKey)] || 'LIVE',
      },
      subscription_data: {
        metadata: {
          product: 'LIVE_CLASS',
          plan: 'LIVE_CLASS',
          level: PLAN_META[String(priceKey)] || 'LIVE',
        },
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (error: any) {
    console.error('[live-checkout] error', error);
    return res.status(500).json({ error: error?.message || 'No se pudo iniciar el checkout.' });
  }
}
