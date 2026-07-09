FROM node:26-bookworm@sha256:e2cd0ff87e2597f66fab50710216e2a08ad2f09bae0ca78f6b31e8c5f1a811a0 AS base
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
