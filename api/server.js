// The page calls this to find out where your computer currently is.
const redis = require("./_redis");

const cors = require("./_cors");

module.exports = async (req, res) => {
  if (cors(req, res)) return;
  res.setHeader("Cache-Control", "no-store");
  try {
    const url = await redis(["GET", "browser:server"]);
    res.status(200).json({ url: url || null });
  } catch (e) {
    res.status(500).json({ url: null, error: String(e.message || e) });
  }
};
