const webDir = path.join(__dirname, "..", "web");

console.log("WEB DIR:", webDir);
console.log("INDEX:", path.join(webDir, "index.html"));
console.log(
  "INDEX EXISTS:",
  fs.existsSync(path.join(webDir, "index.html"))
);

app.use(express.static(webDir));

app.get("/", (req, res) => {
  const indexPath = path.join(webDir, "index.html");

  if (!fs.existsSync(indexPath)) {
    return res.status(500).send("index.html not found: " + indexPath);
  }

  res.sendFile(indexPath);
});
