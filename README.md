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

## Vector Architecture (TEI + Vector API + Qdrant)

- Next.js 专注页面与 API 聚合；向量嵌入与存储检索由独立的 Python `vector-api` 负责。
- Components:
  - `tei` (Hugging Face Text Embeddings Inference) for embeddings
  - `qdrant` for vector storage
  - `vector-api` (FastAPI) wraps TEI + Qdrant with `/upsert` and `/query`
  - `easylish` (Next.js) sets `VECTOR_BACKEND=remote` and calls `vector-api`

### Run with docker-compose

```bash
docker compose -f infra/docker-compose.yml up --build
```

Environment highlights:
- Next.js: `VECTOR_API_URL=http://vector-api:8000` (set in `infra/docker-compose.yml`).
  - Optional: `TEI_BATCH_SIZE` (default 32), `QDRANT_UPSERT_BATCH_SIZE` (default 256)
- TEI: `MODEL_ID=sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (384‑dim multilingual SBERT embeddings).
- Qdrant: persistent storage under `./data/qdrant`.

### How it works
- On startup, the app loads SRT subtitles and calls vector-api `/upsert` to index remotely.
  - Embedding requests auto-micro-batch to TEI (<= `TEI_BATCH_SIZE`).
- Vector search (`strategy=vector`) calls the vector API `/query`, which embeds the query via TEI and searches Qdrant.

### Switching backends
- Remote/search via vector-api (default in compose)
- 本地内存后端已不再推荐；如需改造请自行添加开关

## 容器组织说明

- Web (Next.js): 根目录 `Dockerfile` 仅构建 `apps/web`（monorepo 需要访问根部 workspace 元数据）。
- Vector API (FastAPI): `apps/vector-api/Dockerfile`。字幕数据通过卷挂载到 `/data/subtitles`，不再烘入镜像。
- TEI: 使用官方镜像 `ghcr.io/huggingface/text-embeddings-inference:cpu-1.5`，通过卷挂载模型数据。
- Qdrant: 使用官方镜像，数据卷 `./data/qdrant`。

在 `infra/docker-compose.yml` 中将以上四个服务编排在一起，并为 web、vector-api 配置健康检查与依赖顺序。
