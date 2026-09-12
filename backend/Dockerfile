FROM node:20-alpine AS base
RUN apk add --no-cache openssl

FROM base AS builder
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
COPY tsconfig.json ./
RUN npm install --omit=dev && npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Push schema changes, seed default user, then start server
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx prisma db seed && node dist/server.js"]
