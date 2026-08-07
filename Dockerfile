# Stage 1: Install all dependencies for build
FROM node:24-alpine AS deps

RUN apk add --no-cache openssl libc6-compat \
    && npm install -g yarn@1.22.22 --force

WORKDIR /app

COPY package.json yarn.lock ./
COPY prisma ./prisma/
RUN yarn install --frozen-lockfile --production=false

# Stage 2: Build the NestJS app
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl libc6-compat \
    && npm install -g yarn@1.22.22 --force

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma Client for linux musl
RUN npx prisma generate

# Build NestJS app
RUN yarn run build

# Compile standalone TS scripts to JS for runtime execution
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --esModuleInterop prisma/seed.ts --outDir dist/prisma
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --resolveJsonModule --esModuleInterop scripts/fix-checkin-event-bugs.ts --outDir dist
RUN npx tsc --target ES2021 --module commonjs --skipLibCheck --resolveJsonModule --esModuleInterop scripts/repair-token-35-buyer-voucher-code.ts --outDir dist

# Compile one-off admin scripts

# Stage 3: Install production dependencies only
FROM node:24-alpine AS prod-deps

RUN apk add --no-cache openssl libc6-compat \
    && npm install -g yarn@1.22.22 --force

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
    && npm pack brace-expansion@5.0.8 --pack-destination /tmp \
    && cd /usr/local/lib/node_modules/npm/node_modules \
    && rm -rf brace-expansion \
    && tar -xzf /tmp/brace-expansion-5.0.8.tgz \
    && mv package brace-expansion \
    && rm /tmp/brace-expansion-5.0.8.tgz \
    && node -e "const version = require('./brace-expansion/package.json').version; if (version !== '5.0.8') process.exit(1)" \
    && cd /usr/local/lib/node_modules/npm/node_modules/tinyglobby/node_modules \
    && rm -rf picomatch \
    && npm pack picomatch@4.0.4 --pack-destination . \
    && tar -xzf picomatch-4.0.4.tgz \
    && mv package picomatch \
    && rm picomatch-4.0.4.tgz \
    && npm pack sigstore@4.1.1 --pack-destination /tmp \
    && cd /usr/local/lib/node_modules/npm/node_modules \
    && rm -rf sigstore \
    && tar -xzf /tmp/sigstore-4.1.1.tgz \
    && mv package sigstore \
    && rm /tmp/sigstore-4.1.1.tgz \
    && npm pack tar@7.5.20 --pack-destination /tmp \
    && cd /usr/local/lib/node_modules/npm/node_modules \
    && rm -rf tar \
    && tar -xzf /tmp/tar-7.5.20.tgz \
    && mv package tar \
    && rm /tmp/tar-7.5.20.tgz

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
    node dist/scripts/fix-checkin-event-bugs.js && \
    node dist/scripts/repair-token-35-buyer-voucher-code.js --apply && \
    node dist/src/main \
"]
