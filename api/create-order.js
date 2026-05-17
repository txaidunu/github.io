// api/create-order.js
// Handles order creation for SOL, USDC, and USDT payments

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aeqhjftkaikfquafwwdm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWhqZnRrYWlrZnF1YWZ3d2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODMzMjMsImV4cCI6MjA5MzE1OTMyM30.jKE8LX8-uuYCWiJ6WaeAjXFU0FcWK1n7Q9X6axBId98';
const WALLET_ADDRESS = 'H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4';

// Solana SPL token mint addresses
const TOKEN_MINTS = {
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
};

const PRICES = {
  one: 100,  // $100 = 1 Lunar Cycle
  two: 200   // $200 = 2 Lunar Cycles
};

function generateReference() {
  return 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

// Get live SOL price in USD from Jupiter
async function getSolPrice() {
  try {
    const res = await fetch('https://price.jup.ag/v6/price?ids=SOL');
    const data = await res.json();
    return data.data.SOL.price;
  } catch (err) {
    console.error('Jupiter price error:', err);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { packageType, paymentToken, address } = req.body;

    // Validate inputs
    if (!packageType || !PRICES[packageType]) {
      return res.status(400).json({ error: 'Invalid package type' });
    }
    if (!['SOL', 'USDC', 'USDT'].includes(paymentToken)) {
      return res.status(400).json({ error: 'Invalid payment token. Must be SOL, USDC, or USDT' });
    }
    if (!address || !address.name || !address.address || !address.city || !address.state || !address.zip) {
      return res.status(400).json({ error: 'Missing shipping info' });
    }

    const usdAmount = PRICES[packageType];
    const reference = generateReference();

    // Calculate how much of the token to charge
    let tokenAmount;
    let displayAmount;

    if (paymentToken === 'USDC' || paymentToken === 'USDT') {
      // Stablecoins are 1:1 with USD — easy
      tokenAmount = usdAmount.toString();
      displayAmount = `${usdAmount} ${paymentToken}`;
    } else {
      // SOL: fetch live price so customer always pays $100 or $200 worth
      const solPrice = await getSolPrice();
      if (!solPrice) {
        return res.status(500).json({ error: 'Could not fetch SOL price. Please try again in a moment.' });
      }
      const solAmount = (usdAmount / solPrice).toFixed(4);
      tokenAmount = solAmount;
      displayAmount = `${solAmount} SOL  (~$${usdAmount} USD)`;
    }

    // Build the Solana Pay URL — this is what opens the customer's wallet
    let payUrl;
    if (paymentToken === 'SOL') {
      payUrl = `solana:${WALLET_ADDRESS}?amount=${tokenAmount}&label=Melatonin%20Melange&memo=${encodeURIComponent(reference)}`;
    } else {
      // SPL token payment needs the token mint address
      const mint = TOKEN_MINTS[paymentToken];
      payUrl = `solana:${WALLET_ADDRESS}?spl-token=${mint}&amount=${tokenAmount}&label=Melatonin%20Melange&memo=${encodeURIComponent(reference)}`;
    }

    // Save order to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: supabaseError } = await supabase
      .from('orders')
      .insert([{
        reference,
        package_type: packageType,
        usd_amount: usdAmount,
        token_amount: tokenAmount,
        payment_token: paymentToken,
        customer_name: address.name,
        street: address.address,
        city: address.city,
        state: address.state,
        zip: address.zip,
        status: 'pending',
        created_at: new Date().toISOString()
      }]);

    if (supabaseError) {
      console.error('Supabase error:', supabaseError);
    }

    return res.status(200).json({
      success: true,
      reference,
      orderId: reference,
      usdAmount,
      tokenAmount,
      displayAmount,
      paymentToken,
      payUrl,
      supabaseOk: !supabaseError,
      supabaseStatus: supabaseError ? supabaseError.message : 'saved'
    });

  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
