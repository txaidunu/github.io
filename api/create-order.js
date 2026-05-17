// api/create-order.js
// This runs on Vercel when a customer submits their order

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://aeqhjftkaikfquafwwdm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlcWhqZnRrYWlrZnF1YWZ3d2RtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1ODMzMjMsImV4cCI6MjA5MzE1OTMyM30.jKE8LX8-uuYCWiJ6WaeAjXFU0FcWK1n7Q9X6axBId98';
const WALLET_ADDRESS = 'H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4';

const PRICES = {
  one: 100,   // $100 = 1 Lunar Cycle
  two: 200    // $200 = 2 Lunar Cycles
};

// Generate a unique reference ID for this order
function generateReference() {
  return 'order_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
}

module.exports = async function handler(req, res) {
  // Allow requests from your website
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { packageType, address } = req.body;

    // Validate inputs
    if (!packageType || !PRICES[packageType]) {
      return res.status(400).json({ error: 'Invalid package type' });
    }
    if (!address || !address.name || !address.address || !address.city || !address.state || !address.zip) {
      return res.status(400).json({ error: 'Missing shipping info' });
    }

    const usdAmount = PRICES[packageType];
    const reference = generateReference();

    // Save order to Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: supabaseError } = await supabase
      .from('orders')
      .insert([{
        reference,
        package_type: packageType,
        usd_amount: usdAmount,
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
      // Continue even if Supabase fails — don't block the customer
    }

    // Build Solana Pay URL
    // This opens the customer's wallet app with the payment pre-filled
    const label = encodeURIComponent('Melatonin Melange');
    const memo = encodeURIComponent(reference);
    const message = encodeURIComponent(packageType === 'one' ? '1 Lunar Cycle' : '2 Lunar Cycles');

    // We use SOL amount — approximately $100 or $200 worth
    // For now using a fixed SOL amount; you can integrate a price oracle later
    const solAmount = packageType === 'one' ? '0.5' : '1.0'; // Update these as SOL price changes

    const payUrl = `solana:${WALLET_ADDRESS}?amount=${solAmount}&label=${label}&message=${message}&memo=${memo}`;

    return res.status(200).json({
      success: true,
      reference,
      orderId: reference,
      usdAmount,
      tokenAmount: solAmount + ' SOL',
      payUrl,
      supabaseOk: !supabaseError,
      supabaseStatus: supabaseError ? supabaseError.message : 'saved'
    });

  } catch (err) {
    console.error('Create order error:', err);
    return res.status(500).json({ error: 'Server error: ' + err.message });
  }
};
