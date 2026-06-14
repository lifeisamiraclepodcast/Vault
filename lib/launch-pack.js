import OpenAI from "openai";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5.5";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-2";

export function createClient() {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY is not set.");
    error.statusCode = 500;
    throw error;
  }

  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export function sendText(res, statusCode, text, contentType = "text/plain; charset=utf-8") {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  res.end(text);
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

export function cleanText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildContext(input) {
  const idea = cleanText(input.idea);
  const prefix = cleanText(input.prefix);
  const tone = cleanText(input.tone) || "sharp";
  const platform = cleanText(input.platform) || "LinkedIn Live / StreamYard";

  if (!idea) {
    const error = new Error("A topic or rough idea is required.");
    error.statusCode = 400;
    throw error;
  }

  return { idea, prefix, tone, platform };
}

export function baseInstructions(context) {
  const parts = [
    `Platform: ${context.platform}.`,
    `Tone: ${context.tone}.`,
    context.prefix ? `Brand prefix to preserve when useful: ${context.prefix}.` : "No brand prefix was supplied.",
    `Source idea: ${context.idea}.`,
  ];

  return parts.join(" ");
}

async function generateStructured({ action, schemaName, schema, instructions, userPrompt, client, model }) {
  const response = await client.responses.create({
    model,
    reasoning: { effort: "low" },
    input: [
      {
        role: "system",
        content: instructions,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema,
      },
    },
  });

  const message = response.output?.find((item) => item.type === "message");
  const firstContent = message?.content?.[0];

  if (response.status === "incomplete") {
    const reason = response.incomplete_details?.reason || "unknown";
    const error = new Error(`OpenAI generation was incomplete (${reason}).`);
    error.statusCode = 502;
    throw error;
  }

  if (firstContent?.type === "refusal") {
    const error = new Error(firstContent.refusal || "OpenAI refused the request.");
    error.statusCode = 400;
    throw error;
  }

  if (!response.output_text) {
    const error = new Error(`OpenAI returned no text for ${action}.`);
    error.statusCode = 502;
    throw error;
  }

  try {
    return JSON.parse(response.output_text);
  } catch {
    const error = new Error(`Failed to parse structured output for ${action}.`);
    error.statusCode = 502;
    throw error;
  }
}

function trimTo75Chars(title) {
  const clean = cleanText(title);
  if (clean.length <= 75) return clean;
  const slice = clean.slice(0, 75);
  const lastSpace = slice.lastIndexOf(" ");
  const trimmed = lastSpace > 35 ? slice.slice(0, lastSpace) : slice;
  return trimmed.replace(/[,:;.-]+$/g, "").trim();
}

export async function generateTitle(context, client = createClient()) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      title: {
        type: "string",
        description: "A strong LinkedIn Live title of 75 characters or fewer.",
      },
    },
    required: ["title"],
  };

  const result = await generateStructured({
    action: "title",
    schemaName: "launch_pack_title",
    schema,
    client,
    model: TEXT_MODEL,
    instructions: [
      "You write punchy LinkedIn Live and StreamYard titles.",
      "Make the title feel intentional, promotional, and useful in production.",
      "Return only the schema fields.",
      "Never exceed 75 characters for the title.",
    ].join(" "),
    userPrompt: [
      baseInstructions(context),
      "Generate one title only.",
      "Prefer concrete phrasing over generic language.",
      "If the brand prefix helps, include it naturally at the front or near the start.",
    ].join(" "),
  });

  return { title: trimTo75Chars(result.title) };
}

export async function generateDescription(context, client = createClient()) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      description: {
        type: "string",
        description: "A concise promotional description for the live event.",
      },
      hashtags: {
        type: "array",
        minItems: 5,
        maxItems: 8,
        items: {
          type: "string",
          pattern: "^#[A-Za-z0-9_]+$",
        },
      },
    },
    required: ["description", "hashtags"],
  };

  return generateStructured({
    action: "description",
    schemaName: "launch_pack_description",
    schema,
    client,
    model: TEXT_MODEL,
    instructions: [
      "You write concise promotional event copy.",
      "Return only valid JSON that matches the schema.",
      "Keep the description sharp, direct, and production-ready.",
      "Hashtags must be compact, relevant, and format-safe.",
    ].join(" "),
    userPrompt: [
      baseInstructions(context),
      "Generate a description and 5 to 8 hashtags.",
      "Keep the description readable and promotional, not fluffy.",
      "Avoid hashtags that are too broad or too repetitive.",
    ].join(" "),
  });
}

export async function generateThumbnailPrompt(context, client = createClient()) {
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      thumbnailPrompt: {
        type: "string",
        description: "A detailed prompt for generating a 16:9 LinkedIn Live thumbnail.",
      },
    },
    required: ["thumbnailPrompt"],
  };

  return generateStructured({
    action: "thumbnail prompt",
    schemaName: "launch_pack_thumbnail_prompt",
    schema,
    client,
    model: TEXT_MODEL,
    instructions: [
      "You write image prompts for bold, high-performing social thumbnails.",
      "Prioritize a clean, striking 16:9 composition with obvious subject hierarchy.",
      "Do not describe tiny text or dense layouts.",
      "Make the prompt usable by an image generator directly.",
    ].join(" "),
    userPrompt: [
      baseInstructions(context),
      "Generate a thumbnail prompt for a 16:9 LinkedIn Live image.",
      "The prompt should emphasize a punchy, promotional look and leave room for readable headline text.",
      "Focus on composition, subject, lighting, and visual mood.",
    ].join(" "),
  });
}

export async function generateThumbnail(context, client = createClient()) {
  const promptData = await generateThumbnailPrompt(context, client);
  const thumbnailPrompt = promptData.thumbnailPrompt;

  try {
    const imageResult = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: `${thumbnailPrompt}\n\nContext: ${baseInstructions(context)}`,
      size: "2048x1152",
      quality: "low",
    });

    const imageBase64 = imageResult.data?.[0]?.b64_json;
    if (!imageBase64) {
      return {
        thumbnailPrompt,
        imageAvailable: false,
        error: "Image generation completed without image data.",
      };
    }

    return {
      thumbnailPrompt,
      imageAvailable: true,
      mimeType: "image/png",
      imageBase64,
    };
  } catch (error) {
    return {
      thumbnailPrompt,
      imageAvailable: false,
      error: error?.message || "Thumbnail generation failed.",
    };
  }
}