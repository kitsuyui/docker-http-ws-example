FROM node:26-bookworm@sha256:e7bc1a4cd2419953c91f9a6f7bb6efb3737773093fb4ded0b1c77a0a5831fac4 AS base
WORKDIR /app
RUN npm install -g corepack && corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod
COPY index.js ./
COPY public/ ./public/
ENV HOST=0.0.0.0
ENV PORT=8000
USER node
CMD ["pnpm", "--silent", "start"]
