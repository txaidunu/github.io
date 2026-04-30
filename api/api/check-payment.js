import { Connection, PublicKey } from "@solana/web3.js";

const connection = new Connection("https://api.mainnet-beta.solana.com");

export default async function handler(req, res) {
  const { reference } = req.query;

  try {
    const sigs = await connection.getSignaturesForAddress(
      new PublicKey(reference),
      { limit: 1 }
    );

    if (!sigs.length) {
      return res.json({ paid: false });
    }

    return res.json({
      paid: true,
      signature: sigs[0].signature
    });

  } catch (e) {
    return res.json({ paid: false });
  }
}
