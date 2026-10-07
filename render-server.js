const express = require("express");
const path = require("path");

const serverHandler = require("./server");
const registerHandler = require("./register");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// Existing API endpoints
app.get("/api/server", (req, res) => serverHandler(req, res));
app.post("/api/register", (req, res) => registerHandler(req, res));

// Serve the existing frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Firefox Remote server listening on port ${PORT}`);
});
