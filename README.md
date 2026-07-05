# Pluto AI

Pluto AI is a React + Express AI workspace for chat, coding, file context, and AI-assisted canvas work. It includes custom Pluto models, account sync, quota limits, subscription-ready plans, Turso persistence, and a multi-file project canvas with preview.

## Features

- AI chat with streaming responses
- Pluto model set: `Pluto Nova`, `Pluto Atlas`, `Pluto Apex`
- Automatic AI skill routing for coding, product, demo, and hackathon work
- Ponytail-inspired `Pluto Code` behavior for minimal, practical engineering output
- Dark and light mode
- Auth with JWT
- Turso database sync
- Usage limits and Pro plan logic
- Memory and file context/RAG
- Workspace Home with Canvas Library
- Editable canvases: Document, Code, Plan, Project
- Project canvas with file tree for `index.html`, `style.css`, and `main.js`
- Live HTML/CSS/JS preview iframe
- AI Output Dock with Replace, Append, Apply Selection, New Canvas, and Undo
- Canvas save, history, download, search, filter, duplicate, and delete

## Tech Stack

- Frontend: React, Vite, Lucide React
- Backend: Express
- Database: Turso/libSQL
- Auth: JWT + bcryptjs
- AI: OpenAI-compatible `/v1/chat/completions` API

## Requirements

- Node.js 20+
- npm
- Turso database
- OpenAI-compatible API endpoint and API key

## Setup

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Fill `.env` with your real values.

Run database migration:

```bash
npm run db:migrate
```

Run frontend and backend together:

```bash
npm run dev:full
```

Frontend runs on Vite. Backend runs on:

```text
http://localhost:8787
```

## Scripts

```bash
npm run dev
```

Run Vite frontend only.

```bash
npm run dev:server
```

Run Express API only.

```bash
npm run dev:full
```

Run frontend and backend together.

```bash
npm run db:migrate
```

Create/update Turso tables.

```bash
npm run build
```

Build frontend for production.

## Environment Variables

Required backend env:

```env
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
JWT_SECRET=
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_DEFAULT_MODEL=
```

Frontend env:

```env
VITE_API_BASE=http://localhost:8787
```

Optional limits:

```env
FREE_DAILY_MESSAGES=30
PRO_DAILY_MESSAGES=1000
FREE_DAILY_FILES=5
PRO_DAILY_FILES=100
FREE_MONTHLY_TOKENS=3000000
PRO_MONTHLY_TOKENS=5000000
```

## Plans And Limits

Free plan:

- 30 messages/day
- 3M estimated tokens/month
- 5 canvases
- 2 project canvases
- Nova model only

Pro plan:

- Higher daily message limit
- 5M estimated tokens/month
- 100 canvases
- 30 project canvases
- Nova, Atlas, and Apex models

The current upgrade route is a mock endpoint for development:

```text
POST /api/subscription/mock-upgrade
```

## Deployment Notes

Recommended deployment:

- Frontend: Vercel
- Backend: Railway, Render, Fly.io, or VPS
- Database: Turso

Do not expose `OPENAI_API_KEY` in frontend env. Keep it server-side only.

## Security Notes

- `.env` is ignored by git.
- Use strong `JWT_SECRET` in production.
- Rotate any API keys that were accidentally shared.
- Add a real payment provider before production subscriptions.

## License

Private project unless a license is added.
