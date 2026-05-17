// api/check-payment.js
// This runs on Vercel and checks if a Solana payment has arrived
// When payment is confirmed, it sends you a Telegram message

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aeqhjftkaikfquafwwdm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWhqZnRrYWlrZnF1YWZ3d2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODMzMjMsImV4cCI6MjA5MzE1OTMyM30.jKE8LX8-uuYCWiJ6WaeAjXFU0FcWK1n7Q9X6axBId98';
const WALLET_ADDRESS = 'H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4';

const TELEGRAM_BOT_TOKEN = '8405157983:AAEUGnnvnrPMNq6pnfvmIFpXfyxgwGvqY_M';
const TELEGRAM_CHAT_ID = '@Birdgod23'; // Your Telegram handle

// Send a message to your Telegram
async function sendTelegram(message) {
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
  if (!data.ok) {
    console.error('Telegram error:', data);
  }
  return data;
}

// Check Solana blockchain for a transaction matching this order reference
async function checkSolanaPayment(reference) {
  try {
    // Query the Solana RPC for transactions on your wallet
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

    // Look through recent transactions for one with our reference in the memo
    for (const sig of signatures) {
      if (sig.memo && sig.memo.includes(reference)) {
        return { paid: true, signature: sig.signature };
      }
    }

    return { paid: false };
  } catch (err) {
    console.error('Solana check error:', err);
    return { paid: false, error: err.message };
  }
}

module.exports = async function handler(req, res) {
  // Allow requests from your website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { reference } = req.query;

    if (!reference) {
      return res.status(400).json({ error: 'Missing reference' });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // First check if we already marked this order as paid in Supabase
    // (avoids sending duplicate Telegram messages)
    const { data: existingOrder } = await supabase
      .from('orders')
      .select('*')
      .eq('reference', reference)
      .single();

    if (existingOrder && existingOrder.status === 'paid') {
      return res.status(200).json({ paid: true, alreadyConfirmed: true });
    }

    // Check Solana blockchain for payment
    const payment = await checkSolanaPayment(reference);

    if (payment.paid) {
      // Mark order as paid in Supabase
      await supabase
        .from('orders')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          tx_signature: payment.signature
        })
        .eq('reference', reference);

      // Send Telegram notification to you
      if (existingOrder) {
        const message =
          `🚀 <b>NEW PAID ORDER!</b>\n\n` +
          `📦 Package: ${existingOrder.package_type === 'one' ? '1 Lunar Cycle — $100' : '2 Lunar Cycles — $200'}\n` +
          `👤 Name: ${existingOrder.customer_name}\n` +
          `📍 Address: ${existingOrder.street}\n` +
          `🏙️ City: ${existingOrder.city}, ${existingOrder.state} ${existingOrder.zip}\n` +
          `🔑 Order ID: ${reference}\n` +
          `✅ Payment confirmed on Solana!`;

        await sendTelegram(message);
      }

      return res.status(200).json({ paid: true, signature: payment.signature });
    }

    // Not paid yet
    return res.status(200).json({ paid: false });

  } catch (err) {
    console.error('Check payment error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
