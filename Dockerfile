```dockerfile
FROM node:22-bookworm-slim

# Install LibreOffice for Word-to-PDF and PDF-to-Word conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-writer \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Set application directory
WORKDIR /app

# Copy backend package files and install dependencies
COPY BACKEND/package*.json ./BACKEND/

RUN cd BACKEND && npm install --omit=dev

# Copy the complete project
COPY . .

# Tell the application where LibreOffice is installed
ENV LIBREOFFICE_PATH=/usr/bin/soffice

# Start the backend
WORKDIR /app/BACKEND

CMD ["node", "server.js"]
```
