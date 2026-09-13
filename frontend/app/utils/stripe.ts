export async function payMongoBooking(
  amountInput: string,
  sender: string,
  receiver: string,
  bookingId: string
) {
  const amount = parseInt(amountInput, 10) * 100;

  //4242 4242 4242 4242 

  if (amount < 2000) {
    alert("Invalid Amount - The minimum is ₱20");
    return;
  }

  const referenceId = `${Date.now()}`;

  try {
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        sender,
        receiver,
        bookingId,
        referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      alert(`Failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // ✅ Direct redirect - no Stripe.js needed
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert('Failed to get checkout URL');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Something went wrong.');
  }
}


export async function payMongoRefund(
  amountInput: string,
  sender: string,
  receiver: string,
) {
  const amount = parseInt(amountInput, 10) * 100;

  //4242 4242 4242 4242 

  if (amount < 2000) {
    alert("Invalid Amount - The minimum is ₱20");
    return;
  }

  const referenceId = `${Date.now()}`;

  try {
    const response = await fetch('/api/create-checkout-session-refund', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        sender,
        receiver,
        referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      alert(`Failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // ✅ Direct redirect - no Stripe.js needed
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert('Failed to get checkout URL');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Something went wrong.');
  }
}

export async function payMongoSubs(
  amountInput: string,
  sender: string,
  receiver: string,
  days: number
) {
  const amount = parseInt(amountInput, 10) * 100;

  //4242 4242 4242 4242 

  if (amount < 2000) {
    alert("Invalid Amount - The minimum is ₱20");
    return;
  }

  const referenceId = `${Date.now()}`;

  try {
    const response = await fetch('/api/create-checkout-session-subs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount,
        sender,
        receiver,
        days,
        referenceId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      alert(`Failed: ${data.error || 'Unknown error'}`);
      return;
    }

    // ✅ Direct redirect - no Stripe.js needed
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else {
      alert('Failed to get checkout URL');
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Something went wrong.');
  }
}

