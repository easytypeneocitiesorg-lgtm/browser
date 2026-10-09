// Called by server.py (with the REGISTER_KEY secret) to check many keys at once:
// when a visitor joins, and every few seconds afterwards to catch deactivated / expired keys.
const { verifyMany, serverAuth, readBody } = require("./_keys");

const cors = require("./_cors");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!serverAuth(req, res)) return;
  const items = Array.isArray(readBody(req).items) ? readBody(req).items.slice(0, 200) : [];
  try {
    res.status(200).json({ results: await verifyMany(items) });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
};
