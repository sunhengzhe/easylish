This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Vector Architecture (TEI + Qdrant)

- Next.js 直接调用 TEI 与 Qdrant；不再需要独立 Python 服务。
- Components:
  - `tei` (Hugging Face Text Embeddings Inference) for embeddings
  - `qdrant` for vector storage
  - `easylish` (Next.js) calls TEI/Qdrant when `VECTOR_BACKEND=direct`

### Run with docker-compose

```bash
docker compose -f infra/docker-compose.yml up --build
```

Environment highlights:
- Next.js: `VECTOR_BACKEND=direct`, `TEI_URL=http://tei:80`, `QDRANT_URL=http://qdrant:6333` (set in `infra/docker-compose.yml`).
  - Optional: `TEI_BATCH_SIZE` (default 32), `QDRANT_UPSERT_BATCH_SIZE` (default 256)
- TEI: `MODEL_ID=intfloat/multilingual-e5-small` (384-dim multilingual embeddings).
- Qdrant: persistent storage under `./data/qdrant`.

### How it works
- On startup, the app loads SRT subtitles and directly embeds via TEI, then upserts vectors to Qdrant.
  - Embedding requests auto-micro-batch to TEI (<= `TEI_BATCH_SIZE`).
- Vector search (`strategy=vector`) calls the vector API `/query`, which embeds the query via TEI and searches Qdrant.

### Switching backends
- Direct (default in compose): `VECTOR_BACKEND=direct`
- In-memory (for dev only): unset or `VECTOR_BACKEND=memory` (hash/Xenova fallback)
