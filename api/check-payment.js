// api/check-payment.js
// Checks Solana blockchain for payment confirmation
// Sends Telegram notification when payment is detected

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aeqhjftkaikfquafwwdm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWhqZnRrYWlrZnF1YWZ3d2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODMzMjMsImV4cCI6MjA5MzE1OTMyM30.jKE8LX8-uuYCWiJ6WaeAjXFU0FcWK1n7Q9X6axBId98';
const WALLET_ADDRESS = 'H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4';

const TELEGRAM_BOT_TOKEN = '8405157983:AAEUGnnvnrPMNq6pnfvmIFpXfyxgwGvqY_M';
const TELEGRAM_CHAT_ID = '@Birdgod23';

// Send a Telegram message to you
async function sendTelegram(message) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML'
      })
    });
    const data = await response.json();
    if (!data.ok) console.error('Telegram error:', data);
    return data;
  } catch (err) {
    console.error('Telegram send failed:', err);
  }
}

// Check Solana blockchain for a transaction matching our order reference
async function checkSolanaPayment(reference) {
  try {
    const response = await fetch('https://api.mainnet-beta.solana.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'getSignaturesForAddress',
        params: [
          WALLET_ADDRESS,
          { limit: 20 }
        ]
      })
    });

    const data = await response.json();
    const signatures = data.result || [];

    // Look for a transaction that has our order reference in the memo field
    for (const sig of signatures) {
      if (sig.memo && sig.memo.includes(reference)) {
        return { paid: true, signature: sig.signature };
      }
    }

    return { paid: false };
  } catch (err) {
    console.error('Solana RPC error:', err);
    return { paid: false, error: err.message };
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Check if we already confirmed this order — avoids duplicate Telegram messages
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('reference', reference)
      .single();

    if (existingOrder && existingOrder.status === 'paid') {
      return res.status(200).json({ paid: true, alreadyConfirmed: true });
    }

    // Check the Solana blockchain for payment
    const payment = await checkSolanaPayment(reference);

    if (payment.paid) {
      // Mark as paid in Supabase
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          tx_signature: payment.signature
        })
        .eq('reference', reference);

      // Send Telegram notification to you with full order details
      if (existingOrder) {
        const packageLabel = existingOrder.package_type === 'one'
          ? '1 Lunar Cycle — $100'
          : '2 Lunar Cycles — $200';

        const tokenInfo = existingOrder.payment_token
          ? `${existingOrder.token_amount} ${existingOrder.payment_token}`
          : existingOrder.token_amount + ' SOL';

        const message =
          `🚀 <b>NEW PAID ORDER!</b>\n\n` +
          `📦 <b>Package:</b> ${packageLabel}\n` +
          `💰 <b>Paid:</b> ${tokenInfo}\n` +
          `👤 <b>Name:</b> ${existingOrder.customer_name}\n` +
          `📍 <b>Address:</b> ${existingOrder.street}\n` +
          `🏙️ <b>City:</b> ${existingOrder.city}, ${existingOrder.state} ${existingOrder.zip}\n` +
          `🔑 <b>Order ID:</b> ${reference}\n` +
          `✅ <b>Payment confirmed on Solana!</b>`;

        await sendTelegram(message);
      }

      return res.status(200).json({ paid: true, signature: payment.signature });
    }

    // Payment not found yet — customer's browser will keep checking every 10 seconds
    return res.status(200).json({ paid: false });

  } catch (err) {
    console.error('Check payment error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
