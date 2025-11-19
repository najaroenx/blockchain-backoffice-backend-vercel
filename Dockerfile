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

USER merchant-backoffice

EXPOSE 4000


# Run Prisma migrations and seeds, then start the application
# CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
# CMD ["sh", "-c", "\
#     echo '🚀 Resolving failed Prisma migrations...' && \
#     for dir in $(ls prisma/migrations); do \
#     echo '🧩 Resolving migration:' $dir && \
#     npx prisma migrate resolve --applied $dir || true; \
#     done && \
#     echo '✅ All migrations resolved. Deploying...' && \
#     npx prisma migrate deploy && \
#     echo '✅ Migrations done. Starting app...' && \
#     node dist/src/main \
#     "]
#STAGING VERSION 1
# CMD ["sh", "-c", "\
#   echo '🚀 Running Prisma migrations...' && \
#   npx prisma migrate deploy && \
#   echo '🌱 Running Prisma seed...' && \
#   node dist/prisma/seed.js && \
#   echo '✅ All migrations and seed completed. Starting app...' && \
#   node dist/src/main \
# "]

#STAGING VERSION 2
# CMD ["sh", "-c", "\
#   echo '🚀 Generating Prisma client...' && \
#   npx prisma generate && \
#   echo '🚀 Applying Prisma migrations...' && \
#   npx prisma migrate deploy && \
#   echo '🌱 Seeding data...' && \
#   node dist/prisma/seed.js && \
#   echo '✅ Starting app...' && \
#   node dist/src/main \
#   "]

# DEV FOR RESETTING DB
# DEV / SAFE MODE (reset + generate)
CMD ["sh", "-c", "\
    npx prisma migrate reset --force --skip-generate && \
    node dist/src/main \
"]