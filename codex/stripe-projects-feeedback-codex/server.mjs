import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi } from "./lib/runtime.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";
function serveStatic(req, res) {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const target = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(publicDir, target));

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  readFile(filePath)
    .then((buffer) => {
      const ext = path.extname(filePath);
      const contentType = {
        ".html": "text/html; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8"
      }[ext] || "application/octet-stream";

      res.writeHead(200, { "Content-Type": contentType });
      res.end(buffer);
    })
    .catch(() => {
      res.writeHead(404);
      res.end("Not found");
    });
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res);
    return;
  }
  serveStatic(req, res);
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, host, () => {
    console.log(`Feedback app listening on http://${host}:${port}`);
  });
}
