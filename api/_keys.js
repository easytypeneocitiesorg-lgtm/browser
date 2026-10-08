// Key verification shared by /api/verify (the page) and /api/check (the Python server).
//
// Redis layout (shared with the key generator site):
//   k:<key>    hash: kind, tag, created, expires ("" = never), active ("1"/"0"), owner, usedAt
//   keys       set of every key
//   tag:<TAG>  -> key
const redis = require("./_redis");

const KEY_RE = /^[spd]-[A-Za-z0-9]{6}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{16,64}$/;

function normalizeKey(raw) {
  const s = String(raw || "").trim();
  return s ? s[0].toLowerCase() + s.slice(1) : s;   // the prefix is not case-sensitive; the 6 characters are
}

function toObj(arr) {
  const o = {};
  if (Array.isArray(arr)) for (let i = 0; i + 1 < arr.length; i += 2) o[arr[i]] = arr[i + 1];
  return o;
}

// items: [{key, device}] -> [{ok, reason?, key, kind, tag, expires}]
// A valid, not-yet-used key is bound to the first device that presents it.
async function verifyMany(items) {
  const out = new Array(items.length);
  const idx = [];
  const norm = items.map((it, i) => {
    const key = normalizeKey(it && it.key);
    const device = String((it && it.device) || "");
    if (!KEY_RE.test(key) || !DEVICE_RE.test(device)) out[i] = { ok: false, reason: "invalid" };
    else idx.push(i);
    return { key, device };
  });
  if (!idx.length) return out;

  const recs = await redis.pipeline(idx.map(i => ["HGETALL", "k:" + norm[i].key]));
  const toBind = [];
  idx.forEach((i, n) => {
    const rec = toObj(recs[n]);
    const { key, device } = norm[i];
    if (!rec.kind || !rec.tag) return void (out[i] = { ok: false, reason: "invalid" });
    if (rec.active === "0") return void (out[i] = { ok: false, reason: "deactivated" });
    const exp = rec.expires ? Number(rec.expires) : null;
    if (exp && Date.now() > exp) return void (out[i] = { ok: false, reason: "expired" });
    const good = { ok: true, key, kind: rec.kind, tag: rec.tag, expires: exp };
    if (!rec.owner) toBind.push([i, good]);
    else out[i] = rec.owner === device ? good : { ok: false, reason: "used" };
  });

  if (toBind.length) {
    // HSETNX is atomic: if two devices race for the same key, exactly one wins.
    const won = await redis.pipeline(toBind.map(([i]) => ["HSETNX", "k:" + norm[i].key, "owner", norm[i].device]));
    const lost = [];
    toBind.forEach(([i, good], n) => {
      if (won[n] === 1 || won[n] === "1") out[i] = good; else lost.push([i, good]);
    });
    const cmds = toBind.filter((_, n) => won[n] === 1 || won[n] === "1")
      .map(([i]) => ["HSETNX", "k:" + norm[i].key, "usedAt", String(Date.now())]);
    if (lost.length) {
      const owners = await redis.pipeline(lost.map(([i]) => ["HGET", "k:" + norm[i].key, "owner"]));
      lost.forEach(([i, good], n) => { out[i] = owners[n] === norm[i].device ? good : { ok: false, reason: "used" }; });
    }
    if (cmds.length) await redis.pipeline(cmds);
  }
  return out;
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket.remoteAddress || "?";
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && require("crypto").timingSafeEqual(x, y);
}

// The Python server proves who it is with the REGISTER_KEY secret.
// If the secret is not configured the endpoint refuses to work (fail closed).
function serverAuth(req, res) {
  const need = process.env.REGISTER_KEY;
  if (!need) { res.status(500).json({ error: "REGISTER_KEY is not set in this Vercel project" }); return false; }
  if (!safeEqual(req.headers["x-server-key"], need)) { res.status(403).json({ error: "bad server key" }); return false; }
  return true;
}

function readBody(req) {
  let b = req.body;
  if (typeof b === "string") { try { b = JSON.parse(b); } catch { b = {}; } }
  return b && typeof b === "object" ? b : {};
}

module.exports = { verifyMany, normalizeKey, clientIp, serverAuth, readBody, safeEqual };
