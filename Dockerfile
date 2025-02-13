FROM node AS base
ADD package.json /package.json
RUN npm install
FROM base
ADD index.js /index.js
CMD ["npm", "--silent", "start", "0.0.0.0", "8000"]
