import { randomBytes, randomUUID } from "crypto";

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Encode(buffer) {
  let digits = [0];

  for (const byte of buffer) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  for (const byte of buffer) {
    if (byte === 0) digits.push(0);
    else break;
  }

  return digits.reverse().map(d => BASE58[d]).join("");
}

function generateReference() {
  return base58Encode(randomBytes(32));
}

export default async function handler(req, res) {
  try {
    if (!process.env.SUPABASE_URL) {
      return res.status(500).json({ error: "Missing SUPABASE_URL" });
    }

    if (!process.env.SUPABASE_KEY) {
      return res.status(500).json({ error: "Missing SUPABASE_KEY" });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { packageType, address } = req.body || {};

    const prices = {
      one: 100,
      two: 200
    };

    const usdPrice = prices[packageType];

    if (!usdPrice) {
      return res.status(400).json({ error: "Invalid package" });
    }

    const reference = generateReference();

    const priceResponse = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug"
    );

    const priceData = await priceResponse.json();
    const tokenUsdPrice = parseFloat(priceData.pairs?.[0]?.priceUsd || 0);

    if (!tokenUsdPrice) {
      return res.status(500).json({ error: "Price unavailable" });
    }

    const tokenAmount = (usdPrice / tokenUsdPrice).toFixed(6);
    const orderId = randomUUID();

    const supabaseRes = await fetch(process.env.SUPABASE_URL + "/rest/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": process.env.SUPABASE_KEY,
        "Authorization": "Bearer " + process.env.SUPABASE_KEY
      },
      body: JSON.stringify({
        id: orderId,
        package_type: packageType,
        usd_price: usdPrice,
        token_amount: tokenAmount,
        name: address?.name || "",
        address: address?.address || "",
        city: address?.city || "",
        state: address?.state || "",
        zip: address?.zip || "",
        reference: reference,
        status: "PENDING"
      })
    });

    if (!supabaseRes.ok) {
      const details = await supabaseRes.text();
      return res.status(500).json({
        error: "Supabase insert failed",
        supabaseOk: false,
        supabaseStatus: supabaseRes.status,
        details
      });
    }

    const payUrl =
      "solana:H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4" +
      "?amount=" + encodeURIComponent(tokenAmount) +
      "&spl-token=" + encodeURIComponent("QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug") +
      "&reference=" + encodeURIComponent(reference) +
      "&label=" + encodeURIComponent("Melatonin Melange") +
      "&message=" + encodeURIComponent("Order " + orderId);

    return res.status(200).json({
      orderId,
      reference,
      tokenAmount,
      payUrl,
      supabaseOk: true,
      supabaseStatus: supabaseRes.status
    });

  } catch (e) {
    return res.status(500).json({
      error: "Server error",
      details: e.message
    });
  }
}
