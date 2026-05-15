FROM node:22-bookworm@sha256:9059d9d7db987b86299e052ff6630cd95e5a770336967c21110e53289a877433 AS base
ADD package.json /package.json
RUN npm install
FROM base
ADD index.js /index.js
ENV HOST=0.0.0.0
ENV PORT=8000
CMD ["npm", "--silent", "start"]
