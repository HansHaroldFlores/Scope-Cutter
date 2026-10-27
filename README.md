# Scope Cutter

Scope Cutter turns a broad app idea or product requirements document into a
more manageable feature plan. It uses Gemini to suggest small, buildable
features and sorts them into **Must Have**, **Nice to Have**, and **Cut It**
groups, with effort estimates and individual AI build prompts.

## Features

**Core** (what the app exists to do):

- Generate a feature breakdown from a free-form app idea or PRD.
- Review and edit suggested features, add your own, and move them between
  priority groups (drag-and-drop or arrow buttons).
- Copy the Must Have prompts or download the complete plan as Markdown.
- Column headers show card counts and effort points (Small=1, Medium=3,
  Large=5) so you can tell whether the MVP is realistically sized.
- Clear setup errors: if Gemini is unavailable or the key is rejected, the
  server logs one short message and the app shows an "offline sample
  features" notice instead of failing silently.

**Conveniences** (useful, not required for the core purpose):

- Search and effort filter for the board.
- Undo for delete and Clear Board (5 seconds).
- Recent idea history (last 5 ideas).
- Export/import the board as JSON.
- Ctrl+Enter (Cmd+Enter on Mac) submits the idea.

Boards and idea history are kept in browser local storage and validated on
load, so corrupted saved data is cleared instead of breaking the app.

## Requirements

- [Node.js](https://nodejs.org/) (includes npm) for installing dependencies and running the scripts.
- A Gemini API key for Gemini-generated breakdowns.

## Setup

1. Install dependencies:

   ```sh
   npm install
   ```

2. Create a `.env` file in the project root. You can copy `.env.example`:

   ```powershell
   Copy-Item .env.example .env
   ```

   Then edit `.env` and replace the placeholder with your Gemini API key:

   ```env
   GEMINI_API_KEY=your_actual_api_key
   ```

   The server loads `.env` by default. Put the key in `.env` (not `.env.local`)
   and keep the file private; do not commit it.

## Run locally

Start the development server:

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

To create and run the production build:

```sh
npm run build
npm run start
```

Run the TypeScript check with:

```sh
npm run lint
```

## Troubleshooting

- **"Showing offline sample features"**: Gemini was overloaded or the API key
  was rejected. Check the server terminal for a one-line explanation. Under
  heavy demand the server retries, then tries `gemini-3.5-flash-lite`, and
  always answers within about 25 seconds.
- Set `DEBUG_GEMINI=1` in `.env` to print Gemini's raw responses in the
  terminal.

## Current status and scope

Scope Cutter is the Week 2 capstone version of an MVP/prototype, with a
minimalist light theme. Its current scope is idea-to-feature
decomposition and lightweight planning in a single browser: it does not create
or implement a software project for you. Feature boards are saved in that
browser's local storage; there are no user accounts, shared workspaces, or
server-side project persistence. Gemini is used when a valid API key is
configured; otherwise, the app can return heuristic fallback suggestions.
