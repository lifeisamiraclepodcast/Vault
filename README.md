# LinkedIn Live Launch Pack Generator

A small web app that turns a rough topic into:

- a title
- a description
- hashtags
- a thumbnail prompt
- a real thumbnail image, with graceful fallback if image generation fails

## Stack

- Node.js static server for local development
- Vanilla HTML, CSS, and JavaScript
- OpenAI Responses API for text generation
- OpenAI Image generation for thumbnails

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and add your OpenAI API key.

3. Start the app:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Deploying to Vercel

This repo is structured so Vercel can deploy it directly:

- `index.html` is at the repo root
- static assets live in `public/`
- server-side generation lives in `api/`

To deploy:

1. Push the repo to GitHub.
2. Import the GitHub repo into Vercel.
3. Add `OPENAI_API_KEY` as a Vercel environment variable.
4. Deploy.

## Notes

- Text generation uses `gpt-5.5`.
- Thumbnail generation uses `gpt-image-2`.
- The browser never sees the API key.
- If image generation fails, the app still returns the thumbnail prompt.