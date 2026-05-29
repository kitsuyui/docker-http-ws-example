FROM node:22-bookworm@sha256:9059d9d7db987b86299e052ff6630cd95e5a770336967c21110e53289a877433 AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY index.js client.js ./
ENV HOST=0.0.0.0
ENV PORT=8000
CMD ["pnpm", "--silent", "start"]
