import type { NextApiRequest, NextApiResponse } from 'next';
import Stripe from 'stripe';
import { buffer } from 'micro';
import { createServerClient } from '@/src/lib/supabaseAdmin';

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

function normalizeStatus(status?: string | null) {
  return ['active', 'trialing'].includes(String(status || '').toLowerCase()) ? 'active' : 'inactive';
}

async function upsertEntitlement(args: { email: string; level: string; status: string; eventId: string }) {
  const supabase = createServerClient();
  const { error } = await supabase.from('entitlements').upsert(
    {
      user_email: args.email.toLowerCase(),
      plan: 'LIVE_CLASS',
      level: args.level,
      status: args.status,
      provider: 'stripe',
      last_event_id: args.eventId,
    },
    { onConflict: 'user_email,plan,level' }
  );
  if (error) throw error;
}

async function customerEmail(customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string> {
  if (!customerId) return '';
  if (typeof customerId !== 'string') return customerId.email || '';
  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer) return '';
  return customer.email || '';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');

  let event: Stripe.Event;
  try {
    const sig = req.headers['stripe-signature'];
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, String(sig), webhookSecret);
  } catch (error: any) {
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
      const level = (session.metadata?.level || 'LIVE').toUpperCase();
      if (email) await upsertEntitlement({ email, level, status: 'active', eventId: event.id });
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const email = (await customerEmail(subscription.customer))?.toLowerCase();
      const level = String(subscription.metadata?.level || 'LIVE').toUpperCase();
      if (email) {
        await upsertEntitlement({
          email,
          level,
          status: normalizeStatus(subscription.status),
          eventId: event.id,
        });
      }
    }

    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('[stripe webhook] error', error);
    return res.status(500).json({ error: error?.message || 'internal error' });
  }
}
