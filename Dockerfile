FROM node:20-alpine

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/

COPY index.html app.js style.css admin.html ./web/

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/server.js"]
