import { buildContext, generateDescription, readBody, sendJson } from "../lib/launch-pack.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return sendJson(res, 405, { ok: false, error: "Use POST for API routes." });
    }

    const context = buildContext(await readBody(req));
    return sendJson(res, 200, { ok: true, data: await generateDescription(context) });
  } catch (error) {
    return sendJson(res, error?.statusCode || 500, {
      ok: false,
      error: error?.message || "Unexpected server error.",
    });
  }
}