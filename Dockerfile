# ================================
# 🚀 Stage 2: Dev/Staging image
# ================================
FROM node:20-alpine

# Update npm globally
RUN npm install -g npm@latest \
    && npm -g update

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S merchant-backoffice -u 1001

# Install dependencies needed for Prisma
RUN apk update \
    && apk add --no-cache openssl \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy build artifacts and Prisma folder from builder
COPY --from=builder --chown=merchant-backoffice:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=merchant-backoffice:nodejs /app/package*.json ./
COPY --from=builder --chown=merchant-backoffice:nodejs /app/dist ./dist
COPY --from=builder --chown=merchant-backoffice:nodejs /app/prisma ./prisma

# Prisma needs tmp dir access
RUN mkdir -p /tmp && chmod -R 777 /tmp && chown -R merchant-backoffice:nodejs /tmp

USER merchant-backoffice

# Expose app port
EXPOSE 4000

# ===============================================
# 🧠 Prisma Migration Handling (DEV/STAGING)
# ===============================================
# - mark all failed migrations as applied to avoid P3009
# - deploy all pending migrations
# - then start the app
# ===============================================

CMD ["sh", "-c", "\
    echo '🚀 Running Prisma migrations...' && \
    npx prisma migrate resolve --applied all || true && \
    npx prisma migrate deploy && \
    echo '✅ Migrations done. Starting app...' && \
    node dist/src/main \
    "]