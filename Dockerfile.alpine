FROM node:20-slim

# better-sqlite3 precisa de ferramentas de compilação nativa
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server.js"]
