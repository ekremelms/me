// Tiny static file server for local preview.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = process.env.PORT || 4173;
const TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

http
  .createServer((req, res) => {
    let file = decodeURIComponent(req.url.split("?")[0]);
    if (file === "/") file = "/index.html";
    const full = path.join(ROOT, path.normalize(file));
    if (!full.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(full)] || "application/octet-stream",
      });
      res.end(data);
    });
  })
  .listen(PORT, () => console.log("Serving on http://localhost:" + PORT));
