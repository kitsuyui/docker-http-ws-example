FROM node:26-bookworm@sha256:2aaae6d91f99fee84cfc92da9b52c22a185752d247746052bbc3f961e44478c6 AS base
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
