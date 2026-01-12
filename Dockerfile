# Stage 1: Build the NestJS app
FROM node:20-alpine AS builder

RUN apk update && apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN yarn install --production=false

COPY . .

# Generate Prisma Client for linux musl
RUN npx prisma generate

# Build NestJS app
RUN yarn run build

# Stage 2: Production image
FROM node:20-alpine

RUN apk update && apk add --no-cache openssl libc6-compat

RUN addgroup -g 1001 -S nodejs && \
    adduser -S merchant-backoffice -u 1001

WORKDIR /app

COPY --from=builder --chown=merchant-backoffice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=merchant-backoffice:nodejs /app/dist ./dist
COPY --from=builder --chown=merchant-backoffice:nodejs /app/package*.json ./
COPY --from=builder --chown=merchant-backoffice:nodejs /app/prisma ./prisma
COPY --from=builder --chown=merchant-backoffice:nodejs /app/scripts ./scripts

USER merchant-backoffice

EXPOSE 4000
# DEV FOR RESETTING DB
# DEV / SAFE MODE (reset + generate)
# CMD ["sh", "-c", "\
#     npx prisma migrate reset --force --skip-generate && \
#     node dist/src/main \
# "]
# PROD MODE (migrate + custom script + seed + start)
CMD ["sh", "-c", "\
    npx prisma migrate deploy && \
    npx ts-node scripts/migrate-customer-merchant-created-at.ts && \
    npx prisma db seed && \
    node dist/src/main \
"]