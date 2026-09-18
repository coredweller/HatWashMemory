# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Read this first

`AGENTS.md` holds the full brief: commands, conventions, data model, the timezone and
`better-sqlite3` gotchas, the API table, and verification expectations. Read it before editing.

## Commands

- `npm start` — run the server (`tsx src/index.ts`) on <http://localhost:4180>
- `npm test` — `vitest run`
- `npx tsc --noEmit` — typecheck
- `npm run build` — compile to `dist/`

## Architecture in one paragraph

TypeScript/Node ESM, no framework and no bundler. A `node:http` server renders the entire HTML page
from typed template literals (inline CSS and JS, one `<style>` and one `<script>`), and mutations go
through a small JSON API and then reload the page — so rendering lives in exactly one place. Data is
local SQLite through `better-sqlite3` with raw prepared statements. Pure modules (`rankHats`,
`summarizeHistory`, `dates`, `hatCard`, `renderPage`, `parseImageDataUrl`) are separated from I/O so
the tests need neither a database nor a server.

## Agents, Skills & Rules

Sourced from `F:/Projects/AI/ClaudeCore`:

- `.claude/rules/` — always-loaded shared rules: `core-behaviors.md`, `code-standards.md`,
  `verification-and-reporting.md`, `leverage-patterns.md`. Precedence when rules conflict:
  `core-behaviors` > `code-standards` > `verification-and-reporting` > `leverage-patterns`.
