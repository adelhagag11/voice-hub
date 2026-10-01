const webDir = path.join(__dirname, "..", "web");

app.use(express.static(webDir));

app.get("/", (req, res) => {
  res.sendFile(path.join(webDir, "index.html"));
});
