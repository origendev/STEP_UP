FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY BACKEND/package*.json ./BACKEND/

RUN cd BACKEND && npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV LIBREOFFICE_PATH=/usr/bin/soffice

WORKDIR /app/BACKEND

CMD ["node", "server.js"]