// server.py calls this every 30s to say "I'm online, and my tunnel address is X".
const redis = require("./_redis");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  // Optional shared secret: set REGISTER_KEY in Vercel and pass --register-key to server.py
  const need = process.env.REGISTER_KEY;
  if (need && body.key !== need) return res.status(403).json({ error: "bad key" });

  let u;
  try { u = new URL(body.url); } catch { return res.status(400).json({ error: "bad url" }); }
  if (u.protocol !== "https:") return res.status(400).json({ error: "url must be https" });

  try {
    // Expires after 90s, so a computer that went offline is noticed quickly.
    await redis(["SET", "browser:server", u.origin, "EX", 90]);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
