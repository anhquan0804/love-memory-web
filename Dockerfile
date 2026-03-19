# Use Node.js LTS on Debian slim — required for sharp native binaries
FROM node:18-slim

WORKDIR /app

# Install dependencies first (cached layer when source changes)
COPY package*.json ./
RUN npm install --omit=dev

# Copy application source (uploads/ and .env are excluded via .dockerignore)
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
