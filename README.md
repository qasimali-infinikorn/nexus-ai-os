# Nexus AI Engineering OS

A bring-your-own-key dashboard that routes prompts to specialist LLM
"agents" (system prompts) for engineering-leadership tasks: PR review,
architecture design, client proposals, technology research, and a local
markdown knowledge base with keyword-search RAG.

Built with **Next.js 16** (App Router) and **React 19**. There is no backend
account system — you supply your own OpenAI / Anthropic / Google API key,
which is stored only in your browser's `localStorage` and sent per-request
to the local API routes that call each provider directly.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), open **Configure
Engine** in the sidebar, and paste in the API key(s) for whichever
provider(s) you want to use.

Run the test suite with:

```bash
npm test
```

## Documentation

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — stack, request flow,
  agent/specialist model, and known gaps
- [`docs/API.md`](./docs/API.md) — `/api/orchestrate` and `/api/knowledge`
  request/response reference
- [`docs/SECURITY.md`](./docs/SECURITY.md) — key-handling model and review
  findings

> `AGENTS.md` at the repo root documents a Next.js version/convention quirk
> specific to this repo — read it before making routing or config changes.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
