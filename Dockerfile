FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV LIBREOFFICE_PATH=/usr/bin/soffice

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
      fonts-crosextra-caladea \
      fonts-crosextra-carlito \
      fonts-dejavu-core \
      fonts-liberation \
      libreoffice-pdfimport \
      libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --chown=node:node BACKEND/package.json BACKEND/package-lock.json ./BACKEND/
RUN cd BACKEND && npm ci --omit=dev

COPY --chown=node:node BACKEND ./BACKEND/
COPY --chown=node:node FRONTEND ./FRONTEND/

WORKDIR /app/BACKEND
USER node

EXPOSE 3000

CMD ["npm", "start"]
