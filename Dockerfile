FROM node:22-bookworm-slim

<<<<<<< HEAD
# Install LibreOffice for document conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
=======
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
>>>>>>> af6ca1f1e92eb030d3212baa3ae4e6cf1bffc19f
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

<<<<<<< HEAD
# Install backend dependencies
COPY BACKEND/package*.json ./BACKEND/

RUN cd BACKEND && npm install --omit=dev

# Copy the application
COPY . .

# Configure LibreOffice
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Start the backend
CMD ["node", "BACKEND/server.js"]
=======
COPY --chown=node:node BACKEND/package.json BACKEND/package-lock.json ./BACKEND/
RUN cd BACKEND && npm ci --omit=dev

COPY --chown=node:node BACKEND ./BACKEND/
COPY --chown=node:node FRONTEND ./FRONTEND/

WORKDIR /app/BACKEND
USER node

EXPOSE 3000

CMD ["npm", "start"]
>>>>>>> af6ca1f1e92eb030d3212baa3ae4e6cf1bffc19f
