/**
 * Thin PayMongo REST client — Hosted Checkout Sessions (/v2/checkout_sessions) for org
 * subscriptions (success/cancel redirects) and Payment Links (/v1/payment_links) for parking.
 */

const PAYMONGO_API_V1 = 'https://api.paymongo.com/v1';
const PAYMONGO_API_V2 = 'https://api.paymongo.com/v2';

export type PaymongoCreateLinkInput = {
  amountCentavos: number;
  currency?: string;
  description: string;
  remarks?: string;
  metadata?: Record<string, string>;
};

export type PaymongoPaymentLink = {
  id: string;
  checkoutUrl: string;
  referenceNumber: string | null;
  status: string;
  livemode: boolean;
};

export type PaymongoCreateCheckoutSessionInput = {
  amountCentavos: number;
  currency?: string;
  lineItemName: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
  paymentMethodTypes: string[];
  metadata?: Record<string, string>;
  referenceNumber?: string;
};

export type PaymongoCheckoutSession = {
  id: string;
  checkoutUrl: string;
  livemode: boolean;
};

function getSecretKey(): string {
  const key = Deno.env.get('PAYMONGO_SECRET_KEY')?.trim();
  if (!key) throw new Error('PayMongo is not configured (PAYMONGO_SECRET_KEY missing)');
  return key;
}

function authHeader(secretKey: string): string {
  const encoded = btoa(`${secretKey}:`);
  return `Basic ${encoded}`;
}

function parseLinkResponse(json: Record<string, unknown>): PaymongoPaymentLink {
  const data = json.data as Record<string, unknown> | undefined;
  if (!data?.id) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    const detail = errors?.[0]?.detail ?? 'PayMongo link creation failed';
    throw new Error(detail);
  }

  const url =
    (typeof data.url === 'string' && data.url) ||
    (typeof (data as { checkout_url?: string }).checkout_url === 'string'
      ? (data as { checkout_url: string }).checkout_url
      : '');

  if (!url) throw new Error('PayMongo did not return a checkout URL');

  return {
    id: String(data.id),
    checkoutUrl: url,
    referenceNumber: typeof data.reference_number === 'string' ? data.reference_number : null,
    status: typeof data.status === 'string' ? data.status : 'pending',
    livemode: Boolean(data.livemode),
  };
}

export async function createPaymongoPaymentLink(
  input: PaymongoCreateLinkInput
): Promise<PaymongoPaymentLink> {
  if (!Number.isFinite(input.amountCentavos) || input.amountCentavos < 100) {
    throw new Error('Payment amount must be at least PHP 1.00');
  }

  const secretKey = getSecretKey();
  const body: Record<string, unknown> = {
    amount: Math.round(input.amountCentavos),
    currency: input.currency ?? 'PHP',
    description: input.description.slice(0, 1000),
  };
  if (input.remarks) body.remarks = input.remarks.slice(0, 1000);
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    body.metadata = input.metadata;
  }

  const res = await fetch(`${PAYMONGO_API_V1}/payment_links`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(secretKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    throw new Error(errors?.[0]?.detail ?? `PayMongo HTTP ${res.status}`);
  }

  return parseLinkResponse(json);
}

export function phpToCentavos(amountPhp: number): number {
  return Math.round(amountPhp * 100);
}

export function isPaymongoTestMode(): boolean {
  const key = Deno.env.get('PAYMONGO_SECRET_KEY')?.trim() ?? '';
  return key.startsWith('sk_test');
}

/** Maps super-admin enabled rails to PayMongo Checkout Session `payment_method_types`. */
export function mapPlatformMethodsToPaymongoCheckout(types: string[]): string[] {
  const allowed = new Set(['qrph', 'paymaya', 'gcash', 'grab_pay', 'dob', 'card']);
  const mapped = types.map((t) => t.trim().toLowerCase()).filter((t) => allowed.has(t));
  return mapped.length > 0 ? mapped : ['qrph', 'paymaya', 'gcash'];
}

function parseCheckoutSessionResponse(json: Record<string, unknown>): PaymongoCheckoutSession {
  const data = json.data as Record<string, unknown> | undefined;
  if (!data?.id) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    const detail = errors?.[0]?.detail ?? 'PayMongo checkout session creation failed';
    throw new Error(detail);
  }

  const attrs = data.attributes as Record<string, unknown> | undefined;
  const nextAction = attrs?.next_action as Record<string, unknown> | undefined;
  const url =
    (typeof attrs?.checkout_url === 'string' && attrs.checkout_url) ||
    (typeof attrs?.url === 'string' && attrs.url) ||
    (typeof nextAction?.redirect_url === 'string' ? nextAction.redirect_url : '');

  if (!url) throw new Error('PayMongo did not return a checkout URL');

  return {
    id: String(data.id),
    checkoutUrl: url,
    livemode: Boolean(attrs?.livemode),
  };
}

export async function createPaymongoCheckoutSession(
  input: PaymongoCreateCheckoutSessionInput
): Promise<PaymongoCheckoutSession> {
  if (!Number.isFinite(input.amountCentavos) || input.amountCentavos < 100) {
    throw new Error('Payment amount must be at least PHP 1.00');
  }
  if (!input.successUrl.startsWith('https://') && !input.successUrl.startsWith('http://')) {
    throw new Error('successUrl must be a fully qualified URL');
  }
  if (!input.cancelUrl.startsWith('https://') && !input.cancelUrl.startsWith('http://')) {
    throw new Error('cancelUrl must be a fully qualified URL');
  }

  const secretKey = getSecretKey();
  const paymentMethodTypes = mapPlatformMethodsToPaymongoCheckout(input.paymentMethodTypes);

  const attributes: Record<string, unknown> = {
    line_items: [
      {
        name: input.lineItemName.slice(0, 255),
        amount: Math.round(input.amountCentavos),
        currency: input.currency ?? 'PHP',
        quantity: 1,
      },
    ],
    payment_method_types: paymentMethodTypes,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    show_line_items: true,
    send_email_receipt: false,
  };

  if (input.description) attributes.description = input.description.slice(0, 1000);
  if (input.metadata && Object.keys(input.metadata).length > 0) {
    attributes.metadata = input.metadata;
  }
  if (input.referenceNumber) {
    attributes.reference_number = input.referenceNumber.slice(0, 64);
  }

  const res = await fetch(`${PAYMONGO_API_V2}/checkout_sessions`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(secretKey),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ data: { attributes } }),
  });

  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    throw new Error(errors?.[0]?.detail ?? `PayMongo HTTP ${res.status}`);
  }

  return parseCheckoutSessionResponse(json);
}

/** PayMongo Hosted Checkout Session ids (`cs_…`; legacy `chck_` tolerated). */
export function isPaymongoCheckoutSessionRef(ref: string | null | undefined): boolean {
  const value = ref?.trim() ?? '';
  return value.startsWith('cs_') || value.startsWith('chck_');
}

/** PayMongo Payment Link ids (`link_…`). */
export function isPaymongoPaymentLinkRef(ref: string | null | undefined): boolean {
  return (ref?.trim() ?? '').startsWith('link_');
}

export type PaymongoProviderPaymentState = 'open' | 'paid' | 'expired' | 'unknown';

async function paymongoGetJson(path: string): Promise<Record<string, unknown> | null> {
  const secretKey = getSecretKey();
  const res = await fetch(`https://api.paymongo.com${path}`, {
    headers: {
      Authorization: authHeader(secretKey),
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return null;
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    throw new Error(errors?.[0]?.detail ?? `PayMongo HTTP ${res.status}`);
  }
  return json;
}

function checkoutSessionHasPaidPayment(attrs: Record<string, unknown> | undefined): boolean {
  const sessionStatus = typeof attrs?.status === 'string' ? attrs.status.toLowerCase() : '';
  if (sessionStatus === 'succeeded' || sessionStatus === 'paid') return true;

  const payments = attrs?.payments;
  if (!Array.isArray(payments)) return false;
  return payments.some((entry) => {
    const row = entry as Record<string, unknown>;
    const paymentAttrs = row.attributes as Record<string, unknown> | undefined;
    const status =
      typeof paymentAttrs?.status === 'string' ? paymentAttrs.status.toLowerCase() : '';
    return status === 'paid' || status === 'succeeded';
  });
}

async function fetchPaymongoCheckoutSession(
  sessionId: string
): Promise<Record<string, unknown> | undefined> {
  for (const path of [
    `/v2/checkout_sessions/${encodeURIComponent(sessionId)}`,
    `/v1/checkout_sessions/${encodeURIComponent(sessionId)}`,
  ]) {
    const json = await paymongoGetJson(path);
    const attrs = (json?.data as Record<string, unknown> | undefined)?.attributes as
      Record<string, unknown> | undefined;
    if (attrs) return attrs;
  }
  return undefined;
}

/** Poll PayMongo when a webhook was missed (wrong endpoint, local dev, etc.). */
export async function getPaymongoProviderPaymentState(
  providerReference: string | null | undefined
): Promise<PaymongoProviderPaymentState> {
  const ref = providerReference?.trim();
  if (!ref) return 'unknown';

  try {
    if (isPaymongoCheckoutSessionRef(ref)) {
      const attrs = await fetchPaymongoCheckoutSession(ref);
      if (!attrs) return 'unknown';
      if (checkoutSessionHasPaidPayment(attrs)) return 'paid';
      const status = typeof attrs.status === 'string' ? attrs.status.toLowerCase() : '';
      if (status === 'expired') return 'expired';
      return 'open';
    }

    if (isPaymongoPaymentLinkRef(ref)) {
      const json = await paymongoGetJson(`/v1/links/${encodeURIComponent(ref)}`);
      if (!json) return 'unknown';
      const attrs = (json.data as Record<string, unknown> | undefined)?.attributes as
        Record<string, unknown> | undefined;
      const status = typeof attrs?.status === 'string' ? attrs.status.toLowerCase() : '';
      if (status === 'paid') return 'paid';
      if (status === 'archived') return 'expired';
      return 'open';
    }
  } catch (err) {
    console.error('[paymongoClient] provider status lookup failed', err);
    return 'unknown';
  }

  return 'unknown';
}
