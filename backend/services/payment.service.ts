export interface PayMongoCheckoutDetails {
  paid: boolean;
  amount: number | null;
  paymentMethod: string | null;
  reference: string | null;
  paidAt: Date | null;
}

export const getPayMongoCheckoutDetails = async (checkoutSessionId: string): Promise<PayMongoCheckoutDetails> => {
  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured');
  }

  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(checkoutSessionId)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${PAYMONGO_SECRET_KEY}:`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to verify payment with PayMongo');
  }

  const data = await response.json();
  if (data.errors) {
      console.error('PayMongo Verification Errors:', JSON.stringify(data.errors));
  }

  const attributes = data?.data?.attributes ?? {};
  const intent = attributes.payment_intent?.attributes ?? {};
  const payment = Array.isArray(attributes.payments) ? attributes.payments[0] : null;
  const paymentAttributes = payment?.attributes ?? {};
  const paidAtSeconds = Number(paymentAttributes.paid_at);
  const amountCentavos = Number(paymentAttributes.amount ?? intent.amount);

  return {
    paid: intent.status === 'succeeded',
    amount: Number.isFinite(amountCentavos) ? amountCentavos / 100 : null,
    paymentMethod: paymentAttributes.source?.type || attributes.payment_method_used || null,
    reference: attributes.reference_number || payment?.id || null,
    paidAt: Number.isFinite(paidAtSeconds) && paidAtSeconds > 0 ? new Date(paidAtSeconds * 1000) : null,
  };
};

export const verifyPayMongoPayment = async (checkoutSessionId: string) => {
  const details = await getPayMongoCheckoutDetails(checkoutSessionId);
  return details.paid;
};
