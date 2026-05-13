import { Router } from 'express';
import crypto from 'crypto';

export const webhooksRouter = Router();

type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'PRODUCT_CHANGE'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'BILLING_ISSUE'
  | 'SUBSCRIBER_ALIAS'
  | 'EXPIRATION'
  | 'TRANSFER'
  | 'SUBSCRIPTION_PAUSED'
  | 'GRACE_PERIOD_STARTED'
  | 'GRACE_PERIOD_ENDED';

interface RevenueCatWebhookEvent {
  event: {
    id: string;
    created_at: string;
    type: RevenueCatEventType;
    app_user_id: string;
    aliases: string[];
    product_id: string;
    entitlement_ids: string[];
    period_type: 'NORMAL' | 'TRIAL' | 'INTRO';
    purchased_at_ms: number;
    expiration_at_ms?: number;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    environment: 'SANDBOX' | 'PRODUCTION';
    is_family_share?: boolean;
    country_code?: string;
    currency?: string;
    price?: number;
    price_in_purchased_currency?: number;
    subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
    grace_period_expiration_at_ms?: number;
    auto_resume_at_ms?: number;
  };
  api_version: string;
}

function verifyWebhookSignature(
  payload: string,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  try {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
    const provided = signature.replace(/^sha256=/, '');
    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(provided, 'hex'),
    );
  } catch {
    return false;
  }
}

webhooksRouter.post('/revenuecat', async (req, res) => {
  const rawBody = JSON.stringify(req.body) as string;
  const signature = req.headers['x-revenuecat-signature'] as string | undefined;
  const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET ?? '';

  if (webhookSecret) {
    const valid = verifyWebhookSignature(rawBody, signature, webhookSecret);
    if (!valid) {
      req.log.warn({ signature }, 'RevenueCat webhook signature mismatch');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } else {
    req.log.warn('REVENUECAT_WEBHOOK_SECRET not set — skipping signature verification');
  }

  const body = req.body as RevenueCatWebhookEvent;
  if (!body?.event?.id) {
    return res.status(400).json({ error: 'Invalid event payload' });
  }

  const { event } = body;
  req.log.info({ eventId: event.id, eventType: event.type, userId: event.app_user_id }, 'RevenueCat webhook received');

  try {
    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
        await handleActivation(req, event);
        break;
      case 'CANCELLATION':
      case 'EXPIRATION':
        await handleDeactivation(req, event);
        break;
      case 'PRODUCT_CHANGE':
        await handleProductChange(req, event);
        break;
      case 'BILLING_ISSUE':
      case 'GRACE_PERIOD_STARTED':
        await handleBillingIssue(req, event);
        break;
      case 'GRACE_PERIOD_ENDED':
        await handleGracePeriodEnd(req, event);
        break;
      case 'SUBSCRIPTION_PAUSED':
        await handlePaused(req, event);
        break;
      default:
        req.log.info({ eventType: event.type }, 'Unhandled RevenueCat event type');
    }
    return res.status(200).json({ received: true });
  } catch (err) {
    req.log.error({ err, eventId: event.id }, 'Error processing RevenueCat webhook');
    return res.status(500).json({ error: 'Internal processing error' });
  }
});

async function handleActivation(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.info({
    userId: event.app_user_id,
    productId: event.product_id,
    entitlements: event.entitlement_ids,
    expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null,
  }, 'Subscription activated');
}

async function handleDeactivation(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.info({
    userId: event.app_user_id,
    productId: event.product_id,
  }, 'Subscription deactivated');
}

async function handleProductChange(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.info({
    userId: event.app_user_id,
    newProductId: event.product_id,
  }, 'Subscription product changed');
}

async function handleBillingIssue(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.warn({
    userId: event.app_user_id,
    gracePeriodEndsAt: event.grace_period_expiration_at_ms
      ? new Date(event.grace_period_expiration_at_ms).toISOString()
      : null,
  }, 'Billing issue — grace period started');
}

async function handleGracePeriodEnd(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.warn({
    userId: event.app_user_id,
  }, 'Grace period ended — access revoked');
}

async function handlePaused(req: import('express').Request, event: RevenueCatWebhookEvent['event']) {
  req.log.info({
    userId: event.app_user_id,
    resumeAt: event.auto_resume_at_ms ? new Date(event.auto_resume_at_ms).toISOString() : null,
  }, 'Subscription paused');
}
