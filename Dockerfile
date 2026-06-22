FROM node:26-bookworm@sha256:17895f86b5d1bed5ea97bde2ef4b2e8da46d6024d2eae32a5245bf0d0fb9ecd6 AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY index.js client.js ./
ENV HOST=0.0.0.0
ENV PORT=8000
USER node
CMD ["pnpm", "--silent", "start"]
