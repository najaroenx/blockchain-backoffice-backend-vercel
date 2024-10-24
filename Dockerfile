# Stage 1: Build the NestJS app
FROM node:18-alpine AS builder

# Update npm globally
RUN npm install -g npm@latest \
    && npm -g update

# Update alpine dependencies
RUN apk update \
    && apk upgrade \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN yarn install

# Copy the rest of the application
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the NestJS app
RUN yarn run build

# Stage 2: Production image
FROM node:18-alpine

# Update npm globally
RUN npm install -g npm@latest \
    && npm -g update

# Update alpine dependencies
RUN apk update \
    && apk upgrade \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose application port
EXPOSE 4000

# Run Prisma migrations and seeds, then start the application
CMD ["sh", "-c", "npx prisma migrate deploy && yarn run start:develop-zone"]