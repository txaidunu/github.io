export default async function handler(req, res) {
  const { packageType, address } = req.body;

  const prices = {
    one: 100,
    two: 200
  };

  const usdPrice = prices[packageType];

  if (!usdPrice) {
    return res.status(400).json({ error: "Invalid package" });
  }

  const reference = crypto.randomUUID();

  // fetch token price
  const r = await fetch("https://api.dexscreener.com/latest/dex/tokens/QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug");
  const data = await r.json();

  const price = parseFloat(data.pairs?.[0]?.priceUsd || 0);

  if (!price) {
    return res.status(500).json({ error: "Price unavailable" });
  }

  const tokenAmount = (usdPrice / price).toFixed(6);

  const payUrl =
    "solana:H115kTVj5QsT58w6Xg9hviyoALWqVZ1DLTvhVDeQ66w4" +
    "?amount=" + tokenAmount +
    "&spl-token=QWYpq3zoqkEMywgAVJggtXqXHkhT5HCcFEPpoK5drug" +
    "&reference=" + reference;

  return res.json({
    reference,
    tokenAmount,
    payUrl
  });
}
