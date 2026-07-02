FROM node:26-bookworm@sha256:35d3b83382381e0e2f1d066b98aba486a4fab481a241c7516389635b88d927c1 AS base
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY index.js client.js ./
ENV HOST=0.0.0.0
ENV PORT=8000
USER node
CMD ["pnpm", "--silent", "start"]
