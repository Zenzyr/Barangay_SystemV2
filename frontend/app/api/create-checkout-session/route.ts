import { NextResponse } from 'next/server';

const PAYMONGO_API = 'https://api.paymongo.com/v1/checkout_sessions';
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL_LIVE || 'http://localhost:5000';

// The public origin the resident is redirected back to after paying. When
// NEXT_PUBLIC_BASE_URL_LIVE is not set, derive it from the incoming request
// so the return URL always points back to the frontend the user is on
// (works for both localhost and deployed environments).
function getBaseUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_BASE_URL_LIVE) {
    return process.env.NEXT_PUBLIC_BASE_URL_LIVE.replace(/\/$/, '');
  }
  const url = new URL(req.url);
  return url.origin;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

function getAuthHeader() {
  const key = process.env.PAYMONGO_SECRET_KEY!;
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

export async function POST(req: Request) {
  try {
    const { sender, documentId } = await req.json();

    // Only accept well-formed database ids.
    if (!OBJECT_ID_RE.test(sender) || !OBJECT_ID_RE.test(documentId)) {
      return NextResponse.json({ error: 'Invalid sender or document id' }, { status: 400 });
    }

    // Fetch the stored document request from the backend and charge exactly
    // the recorded price. The client-provided `amount` is IGNORED so a
    // tampered payload cannot change how much the resident is charged.
    let doc;
    try {
      const docRes = await fetch(`${BACKEND_URL}/document-request/${documentId}`, { 
        cache: 'no-store',
        headers: {
          'Authorization': req.headers.get('Authorization') || ''
        }
      });
      if (!docRes.ok) {
        return NextResponse.json({ error: 'Document request not found' }, { status: 404 });
      }
      doc = await docRes.json();
    } catch {
      return NextResponse.json({ error: 'Unable to verify document request' }, { status: 502 });
    }

    const price = Number(doc.price);
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: 'Document price is invalid' }, { status: 400 });
    }

    // centavos as required by PayMongo line_items
    const amount = Math.round(price * 100);
    const referenceId = `${Date.now()}`;

    const body = JSON.stringify({
      data: {
        attributes: {
          line_items: [
            {
              currency: 'PHP',
              amount,
              name: 'Barangay Document Payment',
              description: `Document: ${doc.document || 'Barangay document'} • Ref: ${referenceId}`,
              quantity: 1,
            },
          ],
          payment_method_types: ['gcash'],
          description: `Document payment from ${sender}`,
          success_url: `${getBaseUrl(req)}/payment/success?sender=${sender}&documentId=${documentId}&amount=${amount / 100}&refId=${referenceId}`,
          cancel_url: `${getBaseUrl(req)}/pages/resident/myDocuments`,
          reference_number: referenceId,
        },
      },
    });

    const response = await fetch(PAYMONGO_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: getAuthHeader(),
      },
      body,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('PayMongo error:', data);
      return NextResponse.json(
        { error: data.errors?.[0]?.detail || 'Payment gateway error' },
        { status: response.status }
      );
    }

    // Save the checkout session ID to the backend
    try {
      await fetch(`${BACKEND_URL}/document-request/${documentId}/session`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': req.headers.get('Authorization') || ''
        },
        body: JSON.stringify({ checkoutSessionId: data.data.id })
      });
    } catch (e) {
      console.error("Failed to store session ID in backend", e);
    }

    return NextResponse.json({
      checkoutUrl: data.data.attributes.checkout_url,
    });
  } catch (error) {
    console.error('PayMongo error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}