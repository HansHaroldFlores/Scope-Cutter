# Scope Cutter

Scope Cutter turns a broad app idea or product requirements document into a
more manageable feature plan. It uses Gemini to suggest small, buildable
features and sorts them into **Must Have**, **Nice to Have**, and **Cut It**
groups, with effort estimates and individual AI build prompts.

## Features

- Generate a feature breakdown from a free-form app idea or PRD.
- Review and edit suggested features, add your own, and move them between
  priority groups.
- Copy the Must Have prompts or download the complete plan as Markdown.
- Keep the current board in browser local storage.
- Use heuristic-generated suggestions when Gemini is unavailable.

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

## Current status and scope

Scope Cutter is an early-stage MVP/prototype. Its current scope is idea-to-feature
decomposition and lightweight planning in a single browser: it does not create
or implement a software project for you. Feature boards are saved in that
browser's local storage; there are no user accounts, shared workspaces, or
server-side project persistence. Gemini is used when a valid API key is
configured; otherwise, the app can return heuristic fallback suggestions.
