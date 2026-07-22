# Nexus AI Engineering OS

A bring-your-own-key dashboard that routes prompts to specialist LLM
"agents" (system prompts) for engineering-leadership tasks: PR review,
architecture design, client proposals, technology research, and a
Postgres-backed knowledge base with keyword and pgvector semantic search.

Built with **Next.js 16** (App Router) and **React 19**. There is no backend
account system — you supply your own OpenAI / Anthropic / Google API key,
which is stored only in your browser's `localStorage` and sent per-request
to the local API routes that call each provider directly.

## Getting Started

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL — see docs/DATABASE.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public landing page,
or go to `/login` / `/signup` to enter a workspace.

The Knowledge Base tab needs a Postgres database (with the `pgvector`
extension) to be configured — see [`docs/DATABASE.md`](./docs/DATABASE.md).
Every other tab works without one.

Run the test suite with:

```bash
npm test
```

## Deployment

Live at **https://nexus-ai-os-kohl.vercel.app** (Vercel).

> **Setup needed for the Knowledge Base tab on this deployment:** it
> previously failed there entirely (Vercel's serverless filesystem is
> read-only, and the Knowledge Base used to write to a local `knowledge/`
> directory). It's since been rebuilt on Postgres + Drizzle (see
> [`docs/DATABASE.md`](./docs/DATABASE.md)), but the live deployment doesn't
> have `DATABASE_URL` configured yet — add it via
> `vercel env add DATABASE_URL production` and redeploy to make the
> Knowledge Base tab work there. Every other feature (dashboard/CEO
> orchestration, PR Reviewer, Architecture Studio, Proposal Creator,
> Research Digest) works normally regardless.

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — stack, request flow,
  agent/specialist model, and known gaps
- [`docs/DATABASE.md`](./docs/DATABASE.md) — Postgres/pgvector setup for the
  Knowledge Base, schema, and how to change it
- [`docs/API.md`](./docs/API.md) — `/api/orchestrate` and `/api/knowledge`
  request/response reference
- [`docs/SECURITY.md`](./docs/SECURITY.md) — key-handling model and review
  findings

> `AGENTS.md` at the repo root documents a Next.js version/convention quirk
> specific to this repo — read it before making routing or config changes.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
