FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Node.js 20.x via NodeSource + toolchain de build nativo do better-sqlite3
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg python3 make g++ \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/data

EXPOSE 3001

CMD ["node", "server.js"]
