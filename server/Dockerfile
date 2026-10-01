FROM node:20-alpine

WORKDIR /app

# تثبيت dependencies الخاصة بالسيرفر
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# نسخ كود السيرفر
COPY server/ ./server/

# إنشاء مجلد الواجهة ونسخ ملفاتها
RUN mkdir -p ./web
COPY index.html ./web/
COPY app.js ./web/
COPY style.css ./web/
COPY admin.html ./web/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server/server.js"]
