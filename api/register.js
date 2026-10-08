// server.py calls this every 30s to say "I'm online, and my tunnel address is X".
// Requires the REGISTER_KEY secret (otherwise anyone could point your site at their own server).
const redis = require("./_redis");
const { serverAuth, readBody } = require("./_keys");

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!serverAuth(req, res)) return;

  const body = readBody(req);
  let u;
  try { u = new URL(body.url); } catch { return res.status(400).json({ error: "bad url" }); }
  if (u.protocol !== "https:") return res.status(400).json({ error: "url must be https" });

  try {
    await redis(["SET", "browser:server", u.origin, "EX", 90]);   // expires, so an offline PC is noticed
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
