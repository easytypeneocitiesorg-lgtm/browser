const express = require("express");
const path = require("path");

const serverHandler = require("./api/server");
const registerHandler = require("./api/register");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// API endpoints
app.get("/api/server", (req, res) => serverHandler(req, res));
app.post("/api/register", (req, res) => registerHandler(req, res));

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Serve other static files
app.use(express.static(__dirname));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
