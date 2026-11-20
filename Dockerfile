FROM node:26-bookworm@sha256:b7087bc4d973034b30854b378ba107f9fab622b47514cb7e2592e41b8bab8d49 AS base
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
