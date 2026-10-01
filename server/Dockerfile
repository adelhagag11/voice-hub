FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/

RUN mkdir -p ./web
COPY index.html app.js style.css admin.html ./web/

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "server/server.js"]
