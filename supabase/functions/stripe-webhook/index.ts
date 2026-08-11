import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL           = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

serve(async (req) => {
  const body      = await req.text();
  const sigHeader = req.headers.get('stripe-signature') ?? '';

  // Verify Stripe signature
  let event: any;
  try {
    // Simple HMAC-SHA256 verification
    const encoder  = new TextEncoder();
    const parts    = sigHeader.split(',');
    const ts       = parts.find((p) => p.startsWith('t='))?.slice(2) ?? '';
    const v1       = parts.find((p) => p.startsWith('v1='))?.slice(3) ?? '';
    const payload  = `${ts}.${body}`;
    const key      = await crypto.subtle.importKey('raw', encoder.encode(STRIPE_WEBHOOK_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig      = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const hex      = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    if (hex !== v1) return new Response('Invalid signature', { status: 400 });
    event = JSON.parse(body);
  } catch {
    return new Response('Webhook error', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (event.type === 'checkout.session.completed' || event.type === 'invoice.payment_succeeded') {
    const session      = event.data.object;
    const customerEmail = session.customer_details?.email ?? session.customer_email ?? '';
    if (customerEmail) {
      await supabase.from('users').update({ premium: true }).eq('email', customerEmail);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub           = event.data.object;
    const customerEmail = sub.customer_email ?? '';
    if (customerEmail) {
      await supabase.from('users').update({ premium: false }).eq('email', customerEmail);
    }
  }

  return new Response('OK', { status: 200 });
});
