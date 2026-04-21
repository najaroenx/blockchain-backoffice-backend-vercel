# Stage 1: Install all dependencies for build
FROM node:24-alpine AS deps

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile --production=false

# Stage 2: Build the NestJS app
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for linux musl
RUN npx prisma generate

# Build NestJS app
RUN yarn run build

# Compile standalone TS scripts to JS for runtime execution
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --esModuleInterop prisma/seed.ts --outDir dist/prisma

# Stage 3: Install production dependencies only
FROM node:24-alpine AS prod-deps

RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile --production=true \
    && npx prisma generate \
    && yarn cache clean

# Stage 4: Production image
FROM node:24-alpine

RUN apk add --no-cache openssl libc6-compat \
    && apk upgrade --no-cache zlib

RUN npm install -g npm@11.12.0 --no-audit --no-fund \
    && cd /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules \
    && rm -rf picomatch \
    && npm pack picomatch@4.0.4 --pack-destination . \
    && tar -xzf picomatch-4.0.4.tgz \
    && mv package picomatch \
    && rm picomatch-4.0.4.tgz

RUN addgroup -g 1001 -S nodejs && \
    adduser -S merchant-backoffice -u 1001

WORKDIR /app

COPY --from=prod-deps --chown=merchant-backoffice:nodejs /app/node_modules ./node_modules
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
    node dist/prisma/seed.js && \
    node dist/src/main \
"]