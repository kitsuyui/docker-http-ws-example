FROM node:26-bookworm@sha256:219fc9da91e7f29a9f32290ff598cdf8886fd68f421ff515c8f93434da39a271 AS base
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
