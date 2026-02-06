# MantaSphere Docker Image
# Multi-stage build: self-contained, builds everything inside Docker
# Usage: docker-compose up --build (no pre-build required)

# ============================================================================
# Build Stage: Build the JavaScript bundle
# ============================================================================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies (reproducible builds)
RUN npm ci

# Copy source files needed for build
COPY js ./js
COPY scripts ./scripts
COPY index.html ./
COPY assets ./assets

# Build production bundle (minified, no sourcemaps)
RUN npm run build

# ============================================================================
# Runtime Stage: Serve with nginx
# ============================================================================
FROM nginx:alpine

# Copy built artifacts from build stage
COPY --from=build /app/dist /usr/share/nginx/html/dist
COPY --from=build /app/index.html /usr/share/nginx/html/
COPY --from=build /app/assets /usr/share/nginx/html/assets

# Startup script (runtime config injection)
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 80
CMD ["/start.sh"]
