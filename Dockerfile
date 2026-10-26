FROM node:22-bookworm-slim

# Install LibreOffice for document conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install backend dependencies
COPY BACKEND/package*.json ./BACKEND/

RUN cd BACKEND && npm install --omit=dev

# Copy the application
COPY . .

# Configure LibreOffice
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Start the backend
CMD ["node", "BACKEND/server.js"]