FROM node:22-bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice \
    libreoffice-writer \
    default-jre-headless \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY BACKEND/package*.json ./BACKEND/

RUN cd BACKEND && npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV LIBREOFFICE_PATH=/usr/bin/soffice
ENV HOME=/tmp

WORKDIR /app/BACKEND

CMD ["node", "server.js"]