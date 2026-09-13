import { errorAlert } from "@/app/utils/alert";

export async function payMongoPayment(
  amountInput: string,
  sender: string,
  documentId: string
) {
  // Note: `amountInput` is intentionally not sent to the server. The charge
  // amount is recomputed server-side from the stored document price so a
  // tampered amount cannot change the amount charged.
  void amountInput;

  if (!sender || !documentId) {
    errorAlert("Invalid payment details");
    return;
  }

  try {
    const token = typeof window !== "undefined" ? localStorage.getItem('token') : null;

    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        sender,
        documentId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      errorAlert(`Failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // ✅ Direct redirect - no Stripe.js needed
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      errorAlert('Failed to get checkout URL');
    }
  } catch (error) {
    console.error('Error:', error);
    errorAlert('Something went wrong.');
  }
}