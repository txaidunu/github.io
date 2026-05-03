import { Keypair } from "@solana/web3.js";

export default async function handler(req, res) {
  try {
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

    const reference = Keypair.generate().publicKey.toBase58();

    const priceResponse = await fetch(
      "https://api.dexscreener.com/latest/dex/tokens/QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug"
    );

    const priceData = await priceResponse.json();
    const tokenUsdPrice = parseFloat(priceData.pairs?.[0]?.priceUsd || 0);

    if (!tokenUsdPrice) {
      return res.status(500).json({ error: "Price unavailable" });
    }

    const tokenAmount = (usdPrice / tokenUsdPrice).toFixed(6);
    const orderId = crypto.randomUUID();

    const supabaseRes = await fetch(
      process.env.SUPABASE_URL + "/rest/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.SUPABASE_KEY,
          Authorization: "Bearer " + process.env.SUPABASE_KEY
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
      }
    );

    if (!supabaseRes.ok) {
      const details = await supabaseRes.text();
      return res.status(500).json({
        error: "Supabase insert failed",
        details
      });
    }

    const payUrl =
      "solana:H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4" +
      "?amount=" + encodeURIComponent(tokenAmount) +
      "&spl-token=" + encodeURIComponent("QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug") +
      "&reference=" + encodeURIComponent(reference) +
      "&label=" + encodeURIComponent("Melatonin Melange") +
      "&message=" + encodeURIComponent("Melatonin Melange order");

    return res.status(200).json({
      orderId,
      reference,
      tokenAmount,
      payUrl
    });

  } catch (e) {
    return res.status(405).json({ error: "Method not allowed - NEW VERSION" });
  orderId,
  reference,
  tokenAmount,
  payUrl,
  supabaseOk: supabaseRes.ok,
  supabaseStatus: supabaseRes.status
    });
  }
}
