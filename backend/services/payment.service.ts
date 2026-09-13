export const verifyPayMongoPayment = async (checkoutSessionId: string) => {
  const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;
  if (!PAYMONGO_SECRET_KEY) {
    throw new Error('PAYMONGO_SECRET_KEY is not configured');
  }

  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${checkoutSessionId}`, {
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
  return data.data.attributes.payment_intent.attributes.status === 'succeeded';
};