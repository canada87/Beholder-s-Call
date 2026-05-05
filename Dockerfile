FROM node:20-alpine
WORKDIR /app

# openssl required by Prisma engine binaries (especially on Alpine/musl ARM64)
RUN apk add --no-cache openssl

# Install dependencies first (layer cache)
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
RUN npx prisma generate

# Copy source and build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

EXPOSE 3000

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
