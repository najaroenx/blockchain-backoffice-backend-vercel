# Stage 1: Build the NestJS app
FROM node:20-alpine AS builder

# Update npm globally
RUN npm install -g npm@latest \
    && npm -g update

# Update alpine dependencies
RUN apk update \
    && apk add --no-cache openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN yarn install

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Resolve failed migration and clean up
RUN npx prisma migrate resolve --rolled-back 20251030084722_backoffice_content || true
RUN rm -rf prisma/migrations/20251030084722_backoffice_content || true

# Build the NestJS app
RUN yarn run build

# Stage 2: Production image
FROM node:20-alpine

# Update npm globally
RUN npm install -g npm@latest \
    && npm -g update

RUN addgroup -g 1001 -S nodejs && \
    adduser -S merchant-backoffice -u 1001

# Update alpine dependencies
RUN apk update \
    && apk add --no-cache openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder --chown=merchant-backoffice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=merchant-backoffice:nodejs /app/package*.json ./
COPY --from=builder --chown=merchant-backoffice:nodejs /app/dist ./dist
COPY --from=builder --chown=merchant-backoffice:nodejs /app/prisma ./prisma
COPY --from=builder --chown=merchant-backoffice:nodejs /app/prisma.config.ts ./

# Workaround solution
RUN mkdir -p /tmp && chmod -R 777 /tmp && chown -R merchant-backoffice:nodejs /tmp
# Workaround solution

USER merchant-backoffice

# Expose application port
EXPOSE 4000

# Run Prisma migrations and seeds, then start the application
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]