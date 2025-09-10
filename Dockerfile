# syntax=docker/dockerfile:1.7

# --- Builder stage ---
FROM node:20-slim AS builder

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# Enable corepack (pnpm)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install deps first (better cache)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

# --- Runtime stage ---
FROM node:20-slim AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TRANSFORMERS_CACHE=/app/.cache/transformers \
    VECTOR_PROVIDER=xenova \
    MODEL_ID=Xenova/paraphrase-multilingual-MiniLM-L12-v2

WORKDIR /app

# Create cache directory for model files
RUN mkdir -p /app/.cache/transformers

# Copy standalone server output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Optional: include data directory (or mount as volume in deployment)
COPY --from=builder /app/data ./data

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "server.js"]

