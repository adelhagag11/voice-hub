const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const webDir = path.join(__dirname, "..");

app.use(express.static(webDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
