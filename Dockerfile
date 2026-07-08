FROM node:20-alpine

# better-sqlite3 precisa de ferramentas de compilação nativa
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server.js"]
