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

function classesForLevel(level?: string | null) {
  switch (String(level || '').toUpperCase()) {
    case 'WEEKLY':
      return 5;
    case 'TWO_WEEKS':
      return 10;
    case 'FOUR_WEEKS':
      return 20;
    default:
      return 0;
  }
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

async function wasEventAlreadyProcessed(email: string, level: string, eventId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('entitlements')
    .select('last_event_id')
    .eq('user_email', email.toLowerCase())
    .eq('plan', 'LIVE_CLASS')
    .eq('level', level)
    .maybeSingle();

  if (error) throw error;
  return data?.last_event_id === eventId;
}

async function createUserClassAccess(args: { email: string; level: string; totalClasses: number }) {
  const supabase = createServerClient();

  const payload = {
    email: args.email.toLowerCase(),
    plan_name: args.level,
    total_classes: args.totalClasses,
    classes_used: 0,
    active: true,
    start_date: new Date().toISOString(),
  };

  const { error } = await supabase.from('user_class_access').insert(payload);

  if (error) {
    console.error('[stripe webhook] user_class_access insert error', {
      email: args.email,
      level: args.level,
      totalClasses: args.totalClasses,
      message: error.message,
      details: (error as any).details || null,
      hint: (error as any).hint || null,
      code: (error as any).code || null,
    });
    throw error;
  }
}

async function customerEmail(customerId: string | Stripe.Customer | Stripe.DeletedCustomer | null): Promise<string> {
  if (!customerId) return '';
  if (typeof customerId !== 'string') return customerId.email || '';
  const customer = await stripe.customers.retrieve(customerId);
  if ('deleted' in customer) return '';
  return customer.email || '';
}

async function getSubscription(subscriptionId: string | Stripe.Subscription | null | undefined) {
  if (!subscriptionId) return null;
  if (typeof subscriptionId !== 'string') return subscriptionId;
  return await stripe.subscriptions.retrieve(subscriptionId);
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
      const email = (
        session.metadata?.user_email ||
        session.customer_details?.email ||
        session.customer_email ||
        ''
      ).toLowerCase();

      const level = String(session.metadata?.level || 'LIVE').toUpperCase();
      const purchaseType = String(session.metadata?.purchase_type || 'one_time').toLowerCase();
      const totalClasses = classesForLevel(level);

      if (email) {
        const alreadyProcessed = await wasEventAlreadyProcessed(email, level, event.id);

        await upsertEntitlement({ email, level, status: 'active', eventId: event.id });

        if (!alreadyProcessed && purchaseType !== 'subscription' && totalClasses > 0) {
          console.error('[stripe webhook] creating one-time class package', { email, level, totalClasses, eventId: event.id });
          await createUserClassAccess({ email, level, totalClasses });
        }
      }
    }

    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription = await getSubscription(invoice.subscription as string | undefined);
      const email = (
        subscription?.metadata?.user_email ||
        invoice.customer_email ||
        (await customerEmail(invoice.customer as string | null)) ||
        ''
      ).toLowerCase();

      const level = String(subscription?.metadata?.level || invoice.parent?.subscription_details?.metadata?.level || 'LIVE').toUpperCase();
      const totalClasses = classesForLevel(level);

      if (email && totalClasses > 0) {
        const alreadyProcessed = await wasEventAlreadyProcessed(email, level, event.id);
        await upsertEntitlement({ email, level, status: 'active', eventId: event.id });

        if (!alreadyProcessed) {
          console.error('[stripe webhook] creating subscription class package', { email, level, totalClasses, eventId: event.id });
          await createUserClassAccess({ email, level, totalClasses });
        }
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      const email = (
        subscription.metadata?.user_email ||
        (await customerEmail(subscription.customer)) ||
        ''
      ).toLowerCase();

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
