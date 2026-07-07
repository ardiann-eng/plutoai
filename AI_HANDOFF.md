# Pluto AI Handoff Context

## Project Overview

Pluto AI is a React/Vite + Express AI workspace app. It combines chat, coding, file context, AI skills, subscription limits, Turso sync, and an AI canvas/workspace system.

Repository:

```text
https://github.com/ardiann-eng/plutoai
```

Main local path:

```text
D:\Vibe Coding\Pluto
```

## Stack

- Frontend: React, Vite, Lucide React
- Backend: Express
- Database: Turso/libSQL via `@libsql/client`
- Auth: JWT + bcryptjs
- AI API: OpenAI-compatible `/v1/chat/completions`
- Styling: single `src/styles.css`

## Important Files

```text
src/App.jsx
src/styles.css
src/services/api.js
src/services/openai.js
src/utils/storage.js
server/index.js
server/db.js
server/migrate.js
server/skills.js
README.md
.env.example
```

## Current Model Setup

Frontend model list is in:

```text
src/services/openai.js
```

Models:

```text
Pluto Nova  -> combo/deepseek-v4-flash
Pluto Atlas -> xmtp/mimo-v2.5-pro
Pluto Apex  -> mimo/mimo-v2.5-pro
```

Backend mapping is in `server/index.js`.

The working AI endpoint is configured in `.env` as:

```text
OPENAI_BASE_URL=http://70.153.18.162:8600/v1
```

Important fix already made:

- `dotenv.config({ override: true })` is used in `server/db.js` and `server/index.js` because a stale Windows environment variable was overriding the `.env` API key.

## Current Auth

Email/password auth exists:

```text
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

Google login scaffold exists:

```text
POST /api/auth/google
```

Frontend uses Google Identity Services and needs:

```env
VITE_GOOGLE_CLIENT_ID=
```

Backend needs:

```env
GOOGLE_CLIENT_ID=
```

If Google env is missing, UI shows a clear config error.

## Welcome Wizard

The old skill highlight cards were removed from the main welcome screen.

Skill info now appears inside the compact auth/welcome wizard:

1. Pluto AI Workspace
2. Skill otomatis
3. Cloud sync

After wizard, user sees Google login, email login/register, or guest mode.

## AI Skill System

Backend skill system is in:

```text
server/skills.js
```

Skills are automatic. User does not manually select them.

Main skills:

- Pluto Fast Helper
- Pluto Critical Engineer
- Pluto Code
- Pluto Hackathon Strategist
- Pluto Product Strategist
- Pluto Demo Director

`Pluto Code` is adapted from Ponytail principles:

- minimal correct code
- reuse existing code
- prefer native/stdlib
- avoid unnecessary dependency
- fix root cause
- smallest safe diff

The code contains attribution:

```js
// Adapted from DietrichGebert/ponytail (MIT): https://github.com/DietrichGebert/ponytail
```

## Canvas / Workspace System

Workspace is now a major feature.

Modes:

- Chat
- Coding
- Image
- File
- Workspace
- Settings

Important behavior:

- Coding page no longer auto-opens artifact workspace.
- Workspace menu opens Workspace Home first, not editor directly.
- User chooses or creates canvas from Workspace Home.

Canvas types:

```text
Document
Code
Plan
Project
```

Canvas data shape roughly:

```js
{
  id,
  title,
  type,
  language,
  content,
  files,
  activeFileId,
  versions,
  selection,
  savedAt,
  createdAt,
  updatedAt
}
```

Workspace features already implemented:

- Workspace Home
- Canvas Library
- search/filter canvas
- duplicate/delete canvas
- open/create canvas
- full canvas editor
- preview/edit toggle
- save status
- download
- AI floating composer
- AI Output Dock
- Replace Canvas
- Append
- Apply Selection
- New Canvas from AI
- Undo
- local version history
- cloud save/load via Turso

## Project Canvas

Project canvas is a mini coding workspace.

Default template files:

```text
index.html
style.css
main.js
```

Features:

- file tree
- active file editor
- add file
- rename file
- delete file
- live iframe preview for HTML/CSS/JS
- project download as single `.html` with CSS/JS embedded

Limitations:

- no ZIP export yet
- no full framework runner
- no WebContainer
- no multi-file patch parser yet

Recommended next coding workspace steps:

1. Add AI multi-file patch parser:
   ```text
   FILE: index.html
   ```
2. Show apply preview for affected files.
3. Add ZIP export using `jszip`.
4. Add React/Vite template download, but no browser runner yet.

## Document Download

Document/Plan downloads as `.doc` now, not `.md`.

Implementation:

- `.doc` is HTML-compatible document content.
- Can open in Word/Google Docs/LibreOffice.

Code canvas downloads by language extension:

```text
js, jsx, ts, tsx, html, css, sql, md
```

Project canvas downloads as `.html`.

## Light/Dark UI

Dark and light mode exist.

Theme values are now:

```text
Dark
Light
```

Old values are normalized:

```text
Nebula gelap -> Dark
Orbit violet -> Light
```

Many mobile/light mode fixes were made:

- sidebar mobile spacing
- hidden mobile scrollbars
- search placeholder sizing
- settings modal contrast
- auth wizard contrast
- composer alignment
- workspace mobile layout
- light background less purple on mobile

## Subscription / Limits

Limit system exists server-side.

Free plan:

```text
30 messages/day
3M estimated tokens/month
5 canvases
2 project canvases
20 memory
Nova only
```

Pro plan:

```text
higher message limit from env
5M estimated tokens/month
100 canvases
30 project canvases
500 memory
Nova + Atlas + Apex
```

Mock upgrade endpoint:

```text
POST /api/subscription/mock-upgrade
```

No real payment gateway yet.

Potential payment providers discussed:

- Midtrans
- Xendit
- Tripay
- Duitku

Recommended next payment steps:

1. Pricing UI
2. Checkout endpoint
3. Payment webhook
4. Subscription period handling
5. Billing status page

## Database

Migration file:

```text
server/migrate.js
```

Tables include:

- users
- sessions
- messages
- files
- image_results
- user_preferences
- memories
- document_chunks
- usage_events
- canvases
- subscriptions

Migration was run successfully after adding `canvases`:

```text
npm run db:migrate -> Migrasi Turso selesai.
```

## Important Bug Fixes Already Done

### API key looked invalid but was not

Cause:

- Windows env had stale `OPENAI_API_KEY`.
- `dotenv/config` did not override existing env.

Fix:

- Use `dotenv.config({ override: true })`.

### Signup/chat `ERR_CONNECTION_REFUSED`

Cause:

- Frontend was running but backend `localhost:8787` was not.

Fix:

- Use:
  ```bash
  npm run dev:full
  ```

### `SQLITE_CONSTRAINT: FOREIGN KEY constraint failed`

Cause:

- `/api/ai/chat` inserted messages before session row existed.

Fix:

- `server/index.js` now upserts a session placeholder before inserting first message.

## Scripts

```bash
npm run dev
npm run dev:server
npm run dev:full
npm run db:migrate
npm run build
npm run preview
```

Run full dev stack:

```bash
npm run dev:full
```

## Git Status

Repo is initialized and pushed to:

```text
https://github.com/ardiann-eng/plutoai
```

Last pushed commit at the time of this handoff:

```text
963f830 Add Pluto onboarding and Google auth
```

There may be local changes after that commit. Check with:

```bash
git status --short
```

Before pushing again, always run:

```bash
npm run build
node --check server/index.js
```

## Security Notes

- `.env` is ignored by git.
- `.env.example` exists.
- API keys were discussed in chat; rotate production keys if needed.
- Do not expose `OPENAI_API_KEY` in frontend.
- Google login needs real OAuth client IDs.

## Next Best Tasks

Best high-value next tasks:

1. Polish current Workspace mobile after testing real device.
2. Add multi-file AI patch parser for Project canvas.
3. Add ZIP export for Project canvas.
4. Add real payment gateway.
5. Add guest abuse/rate limit by IP/device.
6. Add real autosave debounce for canvases instead of save-only sync.
7. Add pricing page/modal with Rp10.000/month Pro plan.

## User Preferences From Conversation

- User likes direct implementation, not long theory.
- User wants UI to feel premium, modern, Canva/Figma-level.
- User dislikes UI that looks AI-generated.
- User wants mobile experience polished.
- User wants incremental implementation with reports after each stage.
- User wants technical substance but clear Indonesian language.
- User prefers automatic skills, not manual skill selector.
- User wants Workspace to be powerful but not cluttered.
