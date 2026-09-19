FROM node:26-bookworm@sha256:acb7243cabea678dc927ec9020c633d3d82b37b86b1bbcd49dd3f95f6b77ba89 AS base
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
