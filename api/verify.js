// The page calls this when someone presses "Verify" (or auto-verifies a saved key).
const redis = require("./_redis");
const { verifyMany, clientIp, readBody } = require("./_keys");

const cors = require("./_cors");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "invalid" });
  const body = readBody(req);
  try {
    // Slow down people guessing keys: 30 failed attempts per IP per 10 minutes.
    const rl = "rl:verify:" + clientIp(req);
    const used = Number((await redis(["GET", rl])) || 0);
    if (used >= 30) return res.status(429).json({ ok: false, reason: "rate" });

    const r = (await verifyMany([{ key: body.key, device: body.device }]))[0];
    if (!r.ok && (r.reason === "invalid" || r.reason === "used")) {
      const n = await redis(["INCR", rl]);
      if (n === 1) await redis(["EXPIRE", rl, 600]);
    }
    res.status(200).json(r);
  } catch (e) {
    res.status(500).json({ ok: false, reason: "error", error: String(e.message || e) });
  }
};
