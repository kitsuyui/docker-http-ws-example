FROM node:26-bookworm@sha256:076dd90a458a4baf8b8d2716f022a2c8db245dbe70c7de38bacad1708258eeab AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY index.js client.js ./
ENV HOST=0.0.0.0
ENV PORT=8000
CMD ["pnpm", "--silent", "start"]
