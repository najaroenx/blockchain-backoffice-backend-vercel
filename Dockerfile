# Stage 1: Build the NestJS app
FROM node:20-alpine3.22 AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile --production=false

COPY . .

# Generate Prisma Client for linux musl
RUN npx prisma generate

# Build NestJS app
RUN yarn run build

# Compile standalone TS scripts to JS for runtime execution
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --esModuleInterop scripts/migrate-voucher-merchant-ref-moomuekkung.ts --outDir dist/scripts
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --esModuleInterop prisma/seed.ts --outDir dist/prisma

# Stage 2: Production image
FROM node:20-alpine3.22

RUN apk add --no-cache openssl libc6-compat

RUN addgroup -g 1001 -S nodejs && \
    adduser -S merchant-backoffice -u 1001

WORKDIR /app

COPY --from=builder --chown=merchant-backoffice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=merchant-backoffice:nodejs /app/dist ./dist
COPY --from=builder --chown=merchant-backoffice:nodejs /app/package*.json ./
COPY --from=builder --chown=merchant-backoffice:nodejs /app/prisma ./prisma

USER merchant-backoffice

EXPOSE 4000
# DEV FOR RESETTING DB
# DEV / SAFE MODE (reset + generate)
# CMD ["sh", "-c", "\
#     npx prisma migrate reset --force --skip-generate && \
#     node dist/src/main \
# "]
# PROD MODE (migrate + seed + start)
CMD ["sh", "-c", "\
    npx prisma migrate deploy && \
    node dist/scripts/migrate-voucher-merchant-ref-moomuekkung.js && \
    node dist/prisma/seed.js && \
    node dist/src/main \
"]