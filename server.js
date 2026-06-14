import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildContext,
  generateDescription,
  generateThumbnail,
  generateThumbnailPrompt,
  generateTitle,
  sendJson,
  sendText,
} from "./lib/launch-pack.js";

const PORT = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");

function sendFile(res, filePath, contentType) {
  return readFile(filePath).then((data) => sendText(res, 200, data, contentType));
}

async function routeApi(req, res, action) {
  const body = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        const error = new Error("Request body must be valid JSON.");
        error.statusCode = 400;
        reject(error);
      }
    });
    req.on("error", reject);
  });

  const context = buildContext(body);

  if (action === "title") {
    return sendJson(res, 200, { ok: true, data: await generateTitle(context) });
  }

  if (action === "description") {
    return sendJson(res, 200, { ok: true, data: await generateDescription(context) });
  }

  if (action === "thumbnail-prompt") {
    return sendJson(res, 200, { ok: true, data: await generateThumbnailPrompt(context) });
  }

  if (action === "thumbnail") {
    return sendJson(res, 200, { ok: true, data: await generateThumbnail(context) });
  }

  sendJson(res, 404, { ok: false, error: "Unknown action." });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");

    if (req.method === "POST" && url.pathname === "/api/title") return routeApi(req, res, "title");
    if (req.method === "POST" && url.pathname === "/api/description") return routeApi(req, res, "description");
    if (req.method === "POST" && url.pathname === "/api/thumbnail-prompt") return routeApi(req, res, "thumbnail-prompt");
    if (req.method === "POST" && url.pathname === "/api/thumbnail") return routeApi(req, res, "thumbnail");

    if (req.method === "GET" && url.pathname === "/") {
      return sendFile(res, path.join(__dirname, "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET") {
      const filePath = path.join(publicDir, url.pathname);
      if (!filePath.startsWith(publicDir)) {
        return sendText(res, 403, "Forbidden");
      }

      try {
        const extension = path.extname(filePath).toLowerCase();
        const contentType = {
          ".css": "text/css; charset=utf-8",
          ".js": "application/javascript; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".ico": "image/x-icon",
        }[extension] || "application/octet-stream";
        return sendFile(res, filePath, contentType);
      } catch {
        return sendText(res, 404, "Not found");
      }
    }

    sendJson(res, 404, { ok: false, error: "Not found." });
  } catch (error) {
    sendJson(res, error?.statusCode || 500, {
      ok: false,
      error: error?.message || "Unexpected server error.",
    });
  }
});

server.listen(PORT, () => {
  console.log(`Launch pack generator running on http://localhost:${PORT}`);
});